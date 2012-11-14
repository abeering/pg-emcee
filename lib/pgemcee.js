var memcachespeak = require('./memcachespeak');
var pg = require('pg');

// TODO move the fuck out of here
var con_string = "tcp://postgres@localhost/pgemcee";
var dbh = new pg.Client(con_string);
dbh.connect();

var commands = {
	// retrieval commands
	get: function(task,conn){
		console.log('getting');
	},
	gets: function(task,conn){
		console.log('gets-ing');
	},
	// storage commands
	set: function(task,conn){
		conn.write(memcachespeak.responses.stored());
		console.log('setting');
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
	command_split = command_line.split(' ');
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

