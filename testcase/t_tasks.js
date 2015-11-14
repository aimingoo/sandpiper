// for debug only
var dbg_register_center = require('../node_modules/redpoll/infra/dbg_register_center.js');

// =====================================================================================
// task center
// =====================================================================================
var TaskCenter = require('../infra/TaskCenter.js');
var TaskCenterConfig = {}
var Redpoll = require('redpoll');
var opt = {
 	task_register_center: dbg_register_center,
	distributed_request: Redpoll.infra.httphelper.distributed_request
}
var pedt = new Redpoll(opt);
var def = Redpoll.infra.taskhelper;
var log = console.log.bind(console)
var err = function(e) { console.log(e.stack || e) }

// =====================================================================================
// test cases - 1, run task object at local
// =====================================================================================
var taskObject = {
	x: {
		run: function() {
			console.log('hi');
			return 'ok'
		}
	}
}
pedt.run(taskObject).then(log).catch(err)

// =====================================================================================
// test cases - 2, run/load module at local
// =====================================================================================
// register self as worker in n4c cluster
var worker_mod = require('../tasks/init_worker_node.js')
var unlimit_mod = require('../tasks/init_unlimit_node.js')
var dispatcher_mod = require('../tasks/init_dispatch_node.js');
var upgraded = function() { log("the worker node upgrade as dispatcher." ) }
var init_worker = pedt.run(worker_mod).then(log, err)
var init_unlimited = pedt.run(unlimit_mod).then(log, err)

// Make a token
//	- access secure token, publish by per-server instance
var crypto_crc = require('crc-32');
var CRC32 = function(c) {
	// @see http://www.nilennoct.com/javascript-crc32-fix/
	return function() { return (c.apply(this, arguments) >>> 0).toString(16) }
}(crypto_crc.str)

// Create resource client with arguments
//	- @see taskObject in tasks/init_dispatch_node.js
//	- @see default_config in infra/ResourceCenter.js
var groupBasePath = '/com.wandoujia.n4c/sandpiper/nodes';
var init_dispatch = pedt.run(dispatcher_mod, {
	// systemName: 'sandpiper',
	// serverAddr: '127.0.0.1:3232',
	token: CRC32(groupBasePath),
	groupBasePath: groupBasePath
}).then(pedt.upgrade).then(upgraded, err);

// yes, the n4c is upgraded pedt
n4c = pedt

// =====================================================================================
// test cases - 3, full
// =====================================================================================
var reduceFunc = function(mapedResults) {
	console.log('[INFO] recude result:', mapedResults)
	return true; // return recuded value
}
var daemonFunc = function(args) {
	console.log('[INFO] daemon arguments:', args)
	return {x:100, y:200}; // return arguments for map()
}

function localTask(args) {
	console.log('[INFO] arguments for loacalTask: ', args)
	return "HELLO"
}

// <reged_task> is promise instance
var reged_task = n4c.register_task(def.encode({
	p1: 'default value',
	info: def.run(localTask, {p1: 'new value'})
}))

// ready all and return taskId of <reged_task>
var pick_reged_id = function(results) { return results[0] }
// worker = n4c.run(dispatcher_mod).then(n4c.upgrde, err).then(function() { return reged_task })
//	- or
var worker = Promise.all([reged_task, init_worker, init_unlimited, init_dispatch]).then(pick_reged_id).catch(err);


// reduce/daemon with <reged_task>
var full = 'sandpiper:/com.wandoujia.n4c/sandpiper/nodes:*';
worker.then(function(taskId) {
	console.log('[INFO] distribution scope:', JSON.stringify(full))
	console.log('[INFO] distribution taskId:', JSON.stringify(taskId))
	n4c.reduce(full, taskId, {a:1, b:2, p1:"new value"}, reduceFunc).then(log, err)
	n4c.daemon(full, taskId, daemonFunc, {a:3, b:4}).then(log, err)
}).catch(err)

// register a new taskDef and run it
//	*) the 'def.run' will define a static task for 'run_task' field
worker.then(function(taskId) {
	n4c.register_task(def.encode({
		run_task: def.run(taskId, {p1: "value from remote"})
	}))
	.then(function(taskId2) {
		return n4c.run(taskId2).then(log, err)
	})
	// cant emit() in 'exit' event, so call report() at here
	//		- process.on('exit', opt.task_register_center.report)
	// .then(opt.task_register_center.report)
}).catch(err)

// DONE
console.log('[INFO] done.')