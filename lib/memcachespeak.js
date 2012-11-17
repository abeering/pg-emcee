
function is_number(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

var validators = { 
	many_key: function( command_split ){
		return { valid: true };
	},
	single_key: function( command_split ){
		if( 
			( command_split.length > 3 || command_split.length < 2 ) ||
			( command_split.length == 3 && command_split[2] != 'noreply' ) 
		){
			return { valid: false, error: 'incorrect number of things' };
		}
		return { valid: true };
	},
	single_key_numeric_value: function( command_split ){
		if( 
			( command_split.length > 4 || command_split.length < 3 ) ||
			( command_split.length == 4 && command_split[3] != 'noreply' ) 
		){
			return { valid: false, error: 'incorrect number of things' };
		}
		if( !is_number( command_split[2] ) ){
			return { valid: false, error: 'argument is not a number' };
		}
		return { valid: true };
	},
	storage_command: function( command_split, payload ){
		console.log( command_split[2] );
		console.log( is_number( command_split[2] ) );
		if( command_split.length < 5 || command_split.length > 6 ){
			return { valid: false, error: 'incorrect number of things' };
		}
		if( 
			!is_number(command_split[2]) ||
			!is_number(command_split[3]) ||
			!is_number(command_split[4]) ||
			( command_split[5] && command_split[5] != 'noreply' )
		){ 
			return { valid: false, error: 'malformed arguments' };
		}
		if( payload.length != command_split[4] ){
			// payload length doesn't match pre command bytes
			return { valid: false, error: 'payload is not correct bytes' };
		}
		return { valid: true };
	},
};

var parsers = { 
	storage_command: function( command_split, payload ) {
		return { 
			command: command_split[0],
			key: command_split[1],
			flags: command_split[2],
			exptime: command_split[3],
			bytes: command_split[4],
			noreply: ( command_split[5] ) ? true : false,
			payload: payload,
		};
	},
	multi_key_no_value: function( command_split, payload ) {
		short_command = command_split[0];
		// remove command keyword from command line, keys remaining
		command_split.splice(0,1);
		return { 
			command: short_command,
			keys: command_split,
		};
	},
	single_key_no_value_with_noreply: function( command_split, payload ) {
		return { 
			command: command_split[0],
			key: command_split[1],
			noreply: ( command_split[2] ) ? true : false,
		};
	},
	single_key_single_value_with_noreply: function( command_split, payload ) {
		return { 
			command: command_split[0],
			key: command_split[1],
			value: command_split[2],
			noreply: ( command_split[3] ) ? true : false,
		};
	},
};


exports.commands = { 
	// retrieval commands
	get: {
		is_storage_command:	false,
		validate: validators.many_key,
		parse: parsers.multi_key_no_value,
	},
	gets: {
		is_storage_command:	false,
		validate: validators.many_key,
		parse: parsers.multi_key_no_value,
	},
	// storage commands
	set: {
		is_storage_command: true,
		validate: validators.storage_command,
		parse: parsers.storage_command,
	},
	add: {
		is_storage_command: true,
		validate: validators.storage_command,
		parse: parsers.storage_command,
	},
	replace: {
		is_storage_command: true,
		validate: validators.storage_command,
		parse: parsers.storage_command,
	},
	delete: { 
		is_storage_command: false,
		validate: validators.single_key,
		parse: parsers.single_key_no_value_with_noreply,
	},
	touch: { 
		is_storage_command: false,
		validate: validators.single_key_numeric_value,
		parse: parsers.single_key_single_value_with_noreply,
	},
};

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
	deleted: function(){
		return 'DELETED\r\n';
	},
	touched: function(){
		return 'TOUCHED\r\n';
	},
	not_stored: function(){
		return 'NOT_STORED\r\n';
	},
	not_found: function(){
		return 'NOT_FOUND\r\n';
	},
	value: function(key,flags,bytes,data){
		var key_info = [ key, flags, bytes ].join(' ');
		return 'VALUE ' + key_info + '\r\n' + data + '\r\n';
	},
	end: function(){
		return 'END\r\n';
	},
};


exports.validate_and_parse = function(command_line, payload){
	command_split = command_line.split(' ');
	short_command = command_split[0];

	if( !this.commands[short_command] ){
		// nonexistent command name - ERROR\r\n
		return new Error( this.responses.error() );
	}

	validate_res = this.commands[short_command].validate( command_split, payload );
	if( !validate_res.valid ){
		// invalid command text - CLIENT_ERROR\r\n
		return new Error( this.responses.client_error( validate_res.error ) );
	}

	return this.commands[short_command].parse( command_split, payload );

};
