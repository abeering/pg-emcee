var net = require('net');
var memcachespeak = require('memcachespeak');

var server = net.createServer(function(c) { 
		console.log('connected');

		command_buffer = new Buffer('');
		command_line_group = [];
		awaiting_data = false;

		c.on('data', function(data) {

			command_buffer += data;
			buffer_split = command_buffer.toString().split('\r\n');

			if( buffer_split.length > 1 ){

				command_buffer = buffer_split.splice(-1,1)[0];

				for(i=0;i<buffer_split.length;i++){
					command_line = buffer_split[i];
					
					command_line_group.push(command_line);

					// if we aren't expecting any data next line and this command is a storage command, wait for data 
					if( !awaiting_data && memcachespeak.is_storage_command( command_line ) ){

						awaiting_data = true;

					} else { 

						memcachespeak.run( command_line_group, c );

						// reset command_line_group 
						command_line_group = [];
						awaiting_data = false;

					}

				}

			}
			
		});

		c.on('end', function() {
			console.log('disconnected');
		});
});

server.listen(1337, function() { 
		console.log('bound');
});

console.log('Server running.');
