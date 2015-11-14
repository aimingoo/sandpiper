// -------------------------------------------------------------------------------------------------------
// simple loader/runner demo
//
// NOTE:
//	distributed() called by remote distributioin only.
//
// ex:
//	> node t_runner.js ../tasks/init_publish_node.js nodeAddr="127.0.0.1:8033"
//	> node t_runner.js ../tasks/init_worker_node.js
//	> node t_runner.js ../tasks/init_resource_center.js 
//	...
// -------------------------------------------------------------------------------------------------------

// var def = require('./infra/taskhelper.js');  // a task helper
var Redpoll = require('redpoll');  // a limited executor
var pedt = new Redpoll()

var modName = process.argv[2], args = {};
for (var i=3; i<process.argv.length; i++) {
	var param = process.argv[i].split('='), value = param[1];
	// args[param[0]] = JSON.parse(value);
	args[param[0]] = (value === "true") ? true
		: (value === "false") ? false
		: isNaN(+value) ? value
		: +value;
}

pedt.run(require(modName), args)
	.then(console.log.bind(console));