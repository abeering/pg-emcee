var memcachespeak = require('./memcachespeak');
var pg = require('pg');

// TODO move the fuck out of here
var con_string = "tcp://postgres@localhost/pgemcee";
var db_client = new pg.Client(con_string);
db_client.connect();

function handle_exptime_sqlinterval(secs) {
	if( secs > 0 ){
		// not super happy about the interpolation of this later, but using javascript date objects
		// is messy because of timestamp differences, ideally no time is computed outside of postgres.
		// this would all be a lot easier if there was some way to not escape bind variable in node-postgres
		return "NOW() + INTERVAL '" + secs + " seconds'";
	}
	return null;
}

// methods for pgemcee command tasks, mapping to memcachespeak command names 
// see bottom where we assign some other command classes which operate identically to ones defined below
var commands = {
	// retrieval commands
	get: function(task,conn){
		// construct placeholder string for IN()
		var placeholders = task.keys.map( function(key,i) { 
			return '$'+(i+1); 
		}).join(',');
		// memcache handles key requests which aren't stored as empty responses, so no error handling here (yet)
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
	// storage commands
	set: function(task,conn){
		task.exptime = handle_exptime_sqlinterval(task.exptime);
		db_client.query(
			// use upsert() to update/insert
			'SELECT store_upsert( $1, $2, $3, ' + task.exptime + ', $4 )', 
			[ task.key, task.payload, task.flags, task.bytes ],
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
		task.exptime = handle_exptime_sqlinterval(task.exptime);
		db_client.query(
			// explicit insert, if we receive duplicate key violation we will respond accordingly
			'INSERT INTO store ( key, value, flags, exptime, bytes ) VALUES ( $1, $2, $3, ' + task.exptime + '$4 )', 
			[ task.key, task.payload, task.flags, task.bytes ],
			function(err, result){
				if( err ){
				console.log( err );
					if( err.code = '23505' ){
						conn.write( memcachespeak.responses.not_stored() );
					} else {
						conn.write( memcachespeak.responses.server_error(err) );
					}
				} else { 
					conn.write( memcachespeak.responses.stored() );
				}
			}
		);
	},
	replace: function(task,conn){
		task.exptime = handle_exptime_sqlinterval(task.exptime);
		db_client.query(
			// explicit update, if it doesn't exist we will respond accordingly
			'UPDATE store SET value = $2, flags = $3, exptime = ' + task.exptime + ', bytes = $4 WHERE key = $1', 
			[ task.key, task.payload, task.flags, task.bytes ],
			function(err, result){
				if( err ){
					conn.write( memcachespeak.responses.server_error(err) );
				} else { 
					if( result.rowCount > 0 ){
						conn.write( memcachespeak.responses.stored() );
					} else { 
						conn.write( memcachespeak.responses.not_stored() );
					}
				}
			}
		);
	},
	delete: function(task,conn){
		db_client.query(
			'DELETE FROM store WHERE key = $1', 
			[ task.key ],
			function(err, result){
				if( err ){
					conn.write( memcachespeak.responses.server_error(err) );
				} else { 
					if( result.rowCount > 0 ){
						conn.write( memcachespeak.responses.deleted() );
					} else { 
						conn.write( memcachespeak.responses.not_found() );
					}
				}
			}
		);
	},
	touch: function(task,conn){
		task.value = handle_exptime_sqlinterval(task.value);
		db_client.query(
			'UPDATE store SET exptime = ' + task.value + ' WHERE key = $1', 
			[ task.key ],
			function(err, result){
				if( err ){
					conn.write( memcachespeak.responses.server_error(err) );
				} else { 
					if( result.rowCount > 0 ){
						conn.write( memcachespeak.responses.touched() );
					} else { 
						conn.write( memcachespeak.responses.not_found() );
					}
				}
			}
		);
	},
};
// add alias commands 
commands['gets'] = commands.get;

// check if command requires payload
// TODO this entire process needs a rework, it's also problematic in server.js.  
// ideally we would be validating a storage command independent of it's payload, and not simply cacheing it 
// while we wait for payload.
exports.requires_payload = function(command_line){
	var command_split = command_line.split(' ');
	if( memcachespeak.commands[command_split[0]] && memcachespeak.commands[command_split[0]].is_storage_command ){
		return true;
	}
	return false;
};

exports.run = function(command_line, payload, conn){

	if( task = memcachespeak.validate_and_parse(command_line, payload) ){
	
		if( task instanceof Error ){
			conn.write( task.message );
		} else { 
			commands[task.command](task,conn);
		}
	}

};

exports.do_expiry = function(){
	var query = db_client.query('SELECT key FROM store WHERE exptime IS NOT NULL and exptime < NOW()');
	var keys = [];

	query.on('row', function(row) {
		keys.push( row['key'] );
	});

	query.on('end', function(res) {
		if( keys.length == 0 )
			return;

		// construct placeholder string for IN()
		var placeholders = keys.map( function(key,i) { 
			return '$'+(i+1); 
		}).join(',');
		db_client.query( 
			'DELETE FROM store WHERE key IN (' + placeholders + ')', 
			keys,
			function(err, result){
				if( err ){
					console.log( err );
				} 
			}
		);
	});

};

