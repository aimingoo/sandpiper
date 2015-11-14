// -------------------------------------------------------------------------------------------------------
// init at local, register me as worker node of n4c cluster
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.09
//
// The distributed processing module from NGX_4C architecture
// 	1) N4C is programming framework.
// 	2) N4C = a Controllable & Computable Communication Cluster architectur.
//
// assign right of limited/worker node
// -------------------------------------------------------------------------------------------------------
var local_config = {
	etcdServer: { host: '127.0.0.1', port:'4001' },
	nodeAddr: '127.0.0.1:8032',  // client task accepter address
	systemName: 'sandpiper',
	groupBasePath: '/com.wandoujia.n4c/sandpiper/nodes',
}

var taskObject = {
	isGroupOwner: false,

	// register me as worker node in etcd
	registed: { run: function(args) {
		var etcd = args.etcdServer, ctx = args, opt = args;
		var ignore = function(reason) { }
		var ok = function() { return 'Okay' }
		var workerNodePath = opt.groupBasePath + '/.' + opt.nodeAddr;

		var setOwner = function(result) {
			var ownerInfoPath = opt.groupBasePath + '/groupOwner';
			ctx.update('isGroupOwner', true) // local
			return etcd.set(ownerInfoPath, opt.nodeAddr, {})
		}

		var promise_create_group = function() {
			// will call this.set(dir, null, options, callback);
			return etcd.mkdir(opt.groupBasePath, {}).then(setOwner, ignore)
		}

		var promise_create_node = function() {
			return etcd.set(workerNodePath, (new Date).valueOf(), {}).catch(ignore)
		}

		var promise_set_heartbeat = function() {
			var timeout = 1000, retry = 3, ttl = parseInt(timeout*retry/1000), path=workerNodePath;
			setTimeout(function tick() {
				etcd.set(path, (new Date).valueOf(), {ttl: ttl, prevExist: true})
					.then(function() { setTimeout(tick, timeout) })
			}, timeout)
		}

		return promise_create_group()
			.then(promise_create_node)
			.then(promise_set_heartbeat).then(ok)
	}},

	promised: function() {
		return "the worker node initialized."
	}
}

var local_distributed = function(taskObject) {
	function basePathParser(base, path) {
		return (path.charAt(0) != '/') ? '/' + path
			: path.replace(/^\/\//, '/' + base + '/');
	}

	// about conf of EtcdPromise, @see: create arguments in "node-etcd" module
	var opt = local_config,
		conf = opt.etcdServer,
		EtcdPromise = require('node-etcd-promise');
	if (typeof(conf) == 'object') {
		conf = (conf instanceof String) ? { hosts: [conf] }
			: (conf instanceof Array) ?  { hosts: conf }
			: conf;
	}
	else if (typeof(conf) == 'string') {
		conf = { hosts: [conf] }
	}
	else throw new Error('etcdServer options invalid');

	// set update() interface at taskObject's arguments
	var updater = (function(name, value) { this[name] = value }).bind(taskObject)
	taskObject.registed.arguments = {
		etcdServer: new EtcdPromise(conf.hosts, conf.sslopts, conf.client),
		groupBasePath: basePathParser(opt.systemName, opt.groupBasePath),
		nodeAddr: opt.nodeAddr,
		update: updater
	}
}

local_distributed(taskObject);
module.exports = taskObject;