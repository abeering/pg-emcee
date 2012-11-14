var net = require('net');
var pgemcee = require('./lib/pgemcee');

var server = net.createServer(function(conn) { 
		console.log('connected');

		command_buffer = new Buffer('');
		awaiting_payload = false;
		initial_command = false;

		conn.on('data', function(data) {

			command_buffer += data;
			buffer_split = command_buffer.toString().split('\r\n');

			if( buffer_split.length > 1 ){

				command_buffer = buffer_split.splice(-1,1)[0];

				for(i=0;i<buffer_split.length;i++){
					command_line = buffer_split[i];
					
					if( awaiting_payload ){
					console.log('awaiting payload' );
						pgemcee.run( pre_command_line, command_line, conn );
						// messed this all up, have to refactor shortly
						// reset command_line_group 
						pre_command_line = false;
						awaiting_payload = false;
					} else if( pgemcee.requires_payload( command_line ) ){
					console.log('checking requires payload' );
						pre_command_line = command_line;
						awaiting_payload = true;
					} else { 
					console.log('executing' );
						pgemcee.run( command_line, false, conn );
						// reset command_line_group 
						pre_command_line = false;
						awaiting_payload = false;
					}

				}

			}
			
		});

		conn.on('end', function() {
			console.log('disconnected');
		});
});

server.listen(1337, function() { 
		console.log('bound');
});

console.log('Server running.');
