var memcachespeak = require('./memcachespeak');
var pg = require('pg');

// TODO move the fuck out of here
var con_string = "tcp://postgres@localhost/pgemcee";
var db_client = new pg.Client(con_string);
db_client.connect();

var commands = {
	// retrieval commands
	get: function(task,conn){
		// construct placeholder string for IN()
		var placeholders = task.keys.map( function(key,i) { 
			return '$'+(i+1); 
		}).join(',');
		// set off query
		var query = db_client.query(
			'SELECT * FROM store WHERE key IN (' + placeholders + ')',
			task.keys
		);
		query.on('row', function(row) {
			conn.write( memcachespeak.responses.value(row.key,row.flags,row.bytes,row.value) );
		});
		query.on('end', function(res) {
			conn.write( memcachespeak.responses.end() );
		});
	},
	gets: function(task,conn){
		console.log('gets-ing');
	},
	// storage commands
	set: function(task,conn){
		db_client.query(
			// use upsert and do cool stuff, not this...
			'INSERT INTO store ( key, value, flags, exptime, bytes ) VALUES ( $1, $2, $3, $4, $5 )', 
			[ task.key, task.payload, task.flags, task.exptime, task.bytes ],
			function(err, result){
				if( err ){
					conn.write( memcachespeak.responses.server_error(err) );
				} else { 
					conn.write( memcachespeak.responses.stored() );
				}
			}
		);
	},
	add: function(task,conn){
		console.log('adding');
	},
	replace: function(task,conn){
		console.log('replacing');
	},
};

// check if command requires payload, also validate it 
exports.requires_payload = function(command_line){
	var command_split = command_line.split(' ');
	if( memcachespeak.commands[command_split[0]] && memcachespeak.commands[command_split[0]].is_storage_command ){
		return true;
	}
	return false;
};

exports.run = function(command_line, payload, conn){

	if( task = memcachespeak.parse(command_line, payload) ){
	
		if( task instanceof Error ){
			conn.write( task.message );
		} else { 
			commands[task.command](task,conn);
		}
	}

};

