// =====================================================================================
// Sandpiper v1.0.0
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.11
//
// Sandpiper is implement of N4C architecture in NodeJs.
// 	1) N4C is distribution realtime computing framework.
// 	2) N4C = a Controllable & Computable Communication Cluster architectur.
//
// Usage:
//	var pedt = require('sandpiper')
//	pedt.run(...)
//
// Other:
//	> git clone https://github.com/aimingoo/sandpiper
//	> cd sandpiper
//	> npm install
//	> npm start
//	> #(start new console, and)
//	> npm test
// =====================================================================================
var TaskCenter = require('./infra/TaskCenter.js');
var TaskCenterConfig = {}
var opt = {
	task_register_center: new TaskCenter(TaskCenterConfig)
}

var Redpoll = require('redpoll')
var pedt = new Redpoll(opt);
var log = console.log.bind(console)
var err = function(e) { console.log(e.stack || e) }

var worker_mod = require('./tasks/init_worker_node.js')
var unlimit_mod = require('./tasks/init_unlimit_node.js')
var dispatcher_mod = require('./tasks/init_dispatch_node.js');
var upgraded = function() { log("the worker node upgrade as dispatcher." ) }

Promise.all([
	pedt.run(worker_mod).then(log),
	pedt.run(unlimit_mod).then(log),
	pedt.run(dispatcher_mod).then(pedt.upgrade).then(upgraded)
]).then(function(results){
	console.log('[Sandpiper] initialization finished.');
}).catch(err);

// DONE
module.exports = pedt
console.log('[Sandpiper] loaded.')