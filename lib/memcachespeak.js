// move to utill
// http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric
function is_number(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

var FOO = {};

var responses = {
	error: function(conn){
		conn.write('ERROR\r\n');
	},
	client_error: function(conn, error){ 
		conn.write( 'CLIENT_ERROR ' + error + '\r\n' );
	},
	stored: function(conn){
		conn.write( 'STORED\r\n' );
	},
};

exports.validators = { 
	retrieval_command: function( command_split, command_payload ){
		return { valid: true };
	},
	storage_command: function( command_split, command_payload ){
		if( command_split.length < 5 || command_split.length > 6 ){
			return { valid: false, error: 'incorrect number of things' };
		}
		if( 
			!is_number(command_split[2]) &&
			!is_number(command_split[3]) &&
			!is_number(command_split[4]) &&
			( command_split[5] && command_split[5] != 'noreply' )
		){ 
			return { valid: false, error: 'malformed arguments' };
		}
		if( command_payload.length != command_split[4] ){
			// data size not same as set declaration
			return { valid: false, error: 'payload not same size as declaration' };
		}
		return { valid: true };
	},
}

exports.commands = { 
	get:	{
		is_storage_command:	false,
		validate: this.validators.retrieval_command,
		command_func: function(args, conn){
			console.log('get stuff');
			for(i<0;i<args.keys.length;i++){
				conn.write(FOO[args.keys[i]] + '\r\n');
			}
		},
	},
	set: {
		is_storage_command: true,
		validate: this.validators.storage_command,
		command_func: function(args,conn){
			FOO[args.key] = args.payload;
			responses['stored'](conn);
		},
	},
};

exports.is_storage_command = function(command_line){
	command_split = command_line.split(' ');
	if( this.commands[command_split[0]] && this.commands[command_split[0]].is_storage_command ){
		return true;
	}
	return false;
};

exports.parse = function(command_line_group, conn){
	command_split = command_line_group[0].split(' ');
	short_command = command_split[0];
	command_payload = command_line_group[1];

	if( !this.commands[short_command] ){
		// nonexistent command name - ERROR\r\n
		responses['error'](conn);
		return false;
	}

	validate_res = this.commands[short_command].validate( command_split, command_payload, conn );
	if( !validate_res.valid ){
		// invalid command text - CLIENT_ERROR\r\n
		responses['client_error'](conn,validate_res.error);
		return false;
	}

	if( this.commands[short_command].is_storage_command ){
		return { 
			command: short_command,
			key: command_split[1],
			flags: command_split[2],
			exptime: command_split[3],
			bytes: command_split[4],
			noreply: ( command_split[5] ) ? true : false,
			payload: command_payload,
		};
	} else { 
		// remove command keyword from command line, keys remaining
		command_split.splice(0,1);
		return { 
			command: short_command,
			keys: command_split,
		};
	}

	return false;


};

exports.run = function(command_line_group, conn){

	if( task = this.parse(command_line_group, conn) ){
		this.commands[task.command].command_func(task,conn);
	}

};
