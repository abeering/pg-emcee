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

		payload_buffer = Buffer('');
		payload_size = 0;
		storage_command = '';
		awaiting_payload = false;

		conn.on('data', function(data) {

			buffer_split = data.toString().split('\r\n');
			if( buffer_split[buffer_split.length - 1] == '' ){
				buffer_split.splice(-1,1);
			}

			for(i=0;i<buffer_split.length;i++){

				buffer_command = buffer_split[i];

				if( awaiting_payload ) {

					if( payload_buffer.length == 0 ){
						payload_buffer += buffer_command;
					} else { 
						payload_buffer += ( '\r\n' + buffer_command );
					}

					if( payload_size == payload_buffer.length ){
						pgemcee.run( storage_command, payload_buffer, conn );
						awaiting_payload = false;
						payload_buffer = Buffer('');
					} else if( payload_size < payload_buffer.length ){
						// yech.  i'll figure this out shortly.
						conn.write( 'CLIENT_ERROR bad data chunk\r\n' );
						awaiting_payload = false;
						payload_buffer = Buffer('');
					}

				} else if( payload_size = pgemcee.requires_payload( buffer_command, conn ) ){
					storage_command = buffer_command;
					awaiting_payload = true;
				} else { 
					pgemcee.run( buffer_command, false, conn );
				}

			}

		});

		conn.on('end', function() {
		});
});

server.listen(1337, function() { 
});
