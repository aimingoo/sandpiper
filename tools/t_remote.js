// -------------------------------------------------------------------------------------------------------
// simple remote loader/runner demo
//
// NOTE:
//	distributed() called by remote distributioin only.
//
// ex:
//	> node t_remote.js ../tasks/init_publish_node.js nodeAddr="127.0.0.1:8033"
// -------------------------------------------------------------------------------------------------------

// var def = require('../infra/taskhelper.js');  // a task helper
var Redpoll = require('redpoll');  // a limited executor
var pedt = new Redpoll({
 	task_register_center: require('../node_modules/redpoll/infra/dbg_register_center.js')
})

var modName = process.argv[2], args = {};
for (var i=3; i<process.argv.length; i++) {
	var param = process.argv[i].split('='), value = param[1];
	// args[param[0]] = JSON.parse(value);
	args[param[0]] = (value === "true") ? true
		: (value === "false") ? false
		: isNaN(+value) ? value
		: +value;
}

var log = console.log.bind(console);
var err = function(e) { console.log(e.stack||e) };
pedt.register_task(require(modName))
	.then(function(taskId) { return pedt.run(taskId, args) })
	.then(log, err)