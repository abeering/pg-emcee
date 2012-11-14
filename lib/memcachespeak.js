
function is_number(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

exports.responses = {
	error: function(){
		return 'ERROR\r\n';
	},
	client_error: function(error){
		return 'CLIENT_ERROR ' + error + '\r\n';
	},
	server_error: function(error){
		return 'SERVER_ERROR ' + error + '\r\n';
	},
	stored: function(){
		return 'STORED\r\n';
	},
	not_stored: function(){
		return 'NOT_STORED\r\n';
	},
	value: function(key,flags,bytes,data){
		var key_info = [ key, flags, bytes ].join(' ');
		return 'VALUE ' + key_info + '\r\n' + data + '\r\n';
	},
	end: function(){
		return 'END\r\n';
	},
};

var validators = { 
	retrieval_command: function( command_split ){
		return { valid: true };
	},
	storage_command: function( command_split ){
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
		return { valid: true };
	},
};

exports.commands = { 
	// retrieval commands
	get: {
		is_storage_command:	false,
		validate: validators.retrieval_command,
	},
	gets: {
		is_storage_command:	false,
		validate: validators.retrieval_command,
	},
	// storage commands
	set: {
		is_storage_command: true,
		validate: validators.storage_command,
	},
	add: {
		is_storage_command: true,
		validate: validators.storage_command,
	},
	replace: {
		is_storage_command: true,
		validate: validators.storage_command,
	},
};

exports.parse = function(command_line, payload, conn){
	command_split = command_line.split(' ');
	short_command = command_split[0];

	if( !this.commands[short_command] ){
		// nonexistent command name - ERROR\r\n
		return new Error( this.responses.error() );
	}

	validate_res = this.commands[short_command].validate( command_split );
	if( !validate_res.valid ){
		// invalid command text - CLIENT_ERROR\r\n
		return new Error( this.responses.client_error( validate_res.error ) );
	}

	if( this.commands[short_command].is_storage_command ){
		if( payload.length != command_split[4] ){
			// payload length doesn't match pre command bytes
			return new Error( this.responses.client_error( 'payload is not correct bytes' ) );
		}
		return { 
			command: short_command,
			key: command_split[1],
			flags: command_split[2],
			exptime: command_split[3],
			bytes: command_split[4],
			noreply: ( command_split[5] ) ? true : false,
			payload: payload,
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
