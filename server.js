var net = require('net');
var pgemcee = require('./lib/pgemcee');

// set off reaper for expiring keys
// set to 5 seconds - going to figure out how much of an effect this has during 
// some benchmarking
setInterval( 
	function(){ 
		pgemcee.do_expiry();
	}, 5000 
);

var server = net.createServer(function(conn) { 

		command_buffer = new Buffer('');
		awaiting_payload = false;
		pre_command_line = false;

		conn.on('data', function(data) {

			command_buffer += data;
			buffer_split = command_buffer.toString().split('\r\n');

			if( buffer_split.length > 1 ){

				command_buffer = buffer_split.splice(-1,1)[0];

				for(i=0;i<buffer_split.length;i++){
					command_line = buffer_split[i];

					if( pgemcee.requires_payload( command_line ) ){
						pre_command_line = command_line;
						awaiting_payload = true;
					} else if( awaiting_payload ) {
						pgemcee.run( pre_command_line, command_line, conn );
						awaiting_payload = false;
						pre_command_line = false;
					} else { 
						pgemcee.run( command_line, false, conn );
					}

				}

			}
			
		});

		conn.on('end', function() {
		});
});

server.listen(1337, function() { 
});
