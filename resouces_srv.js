// =====================================================================================
// Resource Center Service
//
// Usage:
//	1. fist, install and start "etcd",
//	2. and, do these in shell
//		> git clone https://github.com/aimingoo/sandpiper
//		> cd sandpiper
//		> npm install
//		> npm start
// =====================================================================================
var log = console.log.bind(console);
var err = function(e) { console.log(e.stack || e) };

var Redpoll = require('redpoll');
var pedt = new Redpoll({});
var Serv = require('./tasks/init_resource_center.js');
// Serv.setWatcher({
// 	// @see default_config in init_resource_center.js
// 	etcdServer: "127.0.0.1:4001", // or services in a string array, or options object
// 	clientAddr: "127.0.0.1:3232", // equ 'default_config.serverAddr' in ResourceCenter.js
// 	systemName: 'sandpiper',
// 	subscribePath: '/n4c/subscribe',
// 	queryPath: '/n4c/query',
// 	baseResourcePath: '/com.wandoujia.n4c'
// });

var initialization_task = new Serv({
//	//@see local_distributed() in init_resource_center.js
//	systemName: 'sandpiper',
//	groupBasePath: '** reset basePath for Serv instances **'
})
pedt.run(initialization_task).then(function(result) {
	console.log('Current node started at resource server:', result),
	console.log(' - run at:', initialization_task.clientAddr),
	console.log(' - watch at:', initialization_task.groupBasePath),
	console.log('Done.')
}, err);

var initialization_task2 = new Serv({
	groupBasePath: '/com.wandoujia.n4c/sandpiper/nodes'
})
pedt.run(initialization_task2).then(function(result) {
	console.log(' - watch at:', initialization_task2.groupBasePath),
	console.log('Done.')
}, err);

setTimeout(function(){
	console.log('Current resource list:')
	Serv.list(function(token, basePath, resources) {
		console.log(' - item:', token, basePath, resources)
	})
}, 5000)