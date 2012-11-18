var config = {};
config.db = {};
config.pgemcee = {};

// EDIT THIS 
// database configuration
config.db.name = 'pgemcee';
config.db.host = 'localhost';
config.db.user = 'postgres';
config.db.pass = ''; 
config.db.port = '5432';
// pgemcee listening port
config.pgemcee.port = '1337';

module.exports = config;
