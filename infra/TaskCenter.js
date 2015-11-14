// -------------------------------------------------------------------------------------------------------
// Simple task center for N4C
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.09
//
// Usage:
//	var Center = require('./TaskCenter.js');
//	var Distributed = require('./Distributed.js');
//	var opt = { task_register_center: new Center({}) };
//	var n4c = new Distributed(opt);
//	...
//
// Note about dynamic upgrade:
//	n4c.upgrade(opt);
// -------------------------------------------------------------------------------------------------------
var crypto = require('crypto');
var MD5 = function (str) {
	var md5sum = crypto.createHash('md5');
	md5sum.update(str);
	return md5sum.digest('hex');
}

var crypto_crc = require('crc-32');
var CRC32 = function(c) {
	// @see http://www.nilennoct.com/javascript-crc32-fix/
	return function() { return (c.apply(this, arguments) >>> 0).toString(16) }
}(crypto_crc.str)

// remove all keys
// > curl -s -L 'http://127.0.0.1:4001/v2/keys/N4C?dir=true&recursive=true' -XDELETE
var default_config = {
	etcdServer: "127.0.0.1:4001", // or services in a string array, or options object
	nodeAddr: '127.0.0.1:8032',  // client task accepter address, listen in init_publish_node, and config in init_worker_node.js
	systemName: 'N4C',
	tasksPath: '//task_center/tasks',
	nodesPath: '//task_center/nodes'
}

// for get result by "node-etcd-promise" module 
function pick_value(result) {
	return result.body.node.value
}

// original idea from etcd-result-objectify
function Objectify(node) {
  var key = node.key.substr(node.key.lastIndexOf('/') + 1)
  if (node.dir)
    (node.nodes || []).forEach(Objectify, this[key]={});
  else
    this[key] = node.value;
  return this[key]
}


/* ------------------------------------------------------------------------------------------------------
 * Constructor and interfaces of n4c
 * ----------------------------------------------------------------------------------------------------*/
var TaskCenter = function(opt) {
	function basePathParser(base, path) {
		return (path.charAt(0) != '/') ? '/' + path
			: path.replace(/^\/\//, '/' + base + '/');
	}

	// about conf of EtcdPromise, @see: create arguments in "node-etcd" module
	var EtcdPromise = require('node-etcd-promise'),
		opt = opt || {},
		conf = opt.etcdServer || default_config.etcdServer;
	if (typeof(conf) == 'object') {
		conf = (conf instanceof String) ? { hosts: [conf] }
			: (conf instanceof Array) ?  { hosts: conf }
			: conf;
	}
	else if (typeof(conf) == 'string') {
		conf = { hosts: [conf] }
	}
	else throw new Error('etcdServer options invalid');
	this.etcdServer = new EtcdPromise(conf.hosts, conf.sslopts, conf.client);
	// Object.defineProperty(this, "etcdServer", {
	// 	get: function() { return new EtcdPromise(conf.hosts, conf.sslopts, conf.client) }
	// });
	this.nodeAddr = opt.nodeAddr || default_config.nodeAddr;

	var base = (this.systemName = opt.systemName || default_config.systemName);
	this.tasksPath = basePathParser(base, opt.tasksPath || default_config.tasksPath);
	this.nodesPath = basePathParser(base, opt.nodesPath || default_config.nodesPath);

	// publish interfaces
	this.initialized = false;
	return {
		register_task: this.register_task.bind(this),
		download_task: this.download_task.bind(this),
		report: this.report.bind(this)
	}
}

TaskCenter.prototype = {
	register_task: function(taskDef) {
		var conf = this,
			etcd = this.etcdServer,
			clientPath = conf.nodesPath + '/' + conf.nodeAddr;  // CLIENT(conf.nodeAddr)
		var ignore = function(reason) {}
		// var ignore = function(reason) { console.log(reason.stack || reason) }
		var initialized = function() { return conf.initialized = true }
		var make_tasks_node = function() { return etcd.mkdir(conf.nodesPath, {}).catch(initialized) }
		var make_client_node = function() { return etcd.mkdir(clientPath, {}).then(initialized, ignore) }
		var CLIENT = function(addr) { return conf.nodesPath + '/' + addr }
		var TASK = function(id) { return conf.tasksPath + '/' + id }

		function register_task() {
			var id = MD5(taskDef.toString()), crc = CRC32(taskDef.toString());
			var CRED = function(id, cli) { return (cli || clientPath) + '/' + id }
			var INDEX = function(id) { return conf.nodesPath + '/*/' + id }

			var ok = function() { return 'task:' + id }
			var check_crc = function(result) {
				var data = pick_value(result).split(',');
				return (crc == data[0])
					|| Promise.reject(new Error("taskId exist but CRC invalid, registed at: " + new Date(parseInt(data[1]))));
			}
			var pick_verify_data = function(nodeAddr) {
				return etcd.get(CRED(id, CLIENT(pick_value(nodeAddr))), {})
			}
			var registed_success = function() {
				return Promise.all([
					etcd.set(INDEX(id), conf.nodeAddr, {}).catch(ignore),
					etcd.set(CRED(id), [crc, (new Date).valueOf()].join(), {}).catch(ignore)
				]).then(ok)
			}
			var report_exist = function() {
				return etcd.get(INDEX(id), {}).then(pick_verify_data).then(check_crc).then(ok)
			}
			return etcd.set(TASK(id), taskDef, {prevExist: false})
				.then(registed_success, report_exist)
		}
		if (!((typeof(taskDef) == 'string') || (taskDef instanceof String))) {
			return Promise.reject(new Error("Must string type for taskDef argument"))
		}
		return Promise.resolve(conf.initialized
			|| make_tasks_node().then(make_client_node)).then(register_task);
	},

	download_task: function(taskId) {
		// var conf = this, id = taskId.replace(/^task:/, "");
		// var TASK = function(id) { return conf.tasksPath + '/' + id }
		// return this.etcdServer.get(TASK(id), {}).then(pick_value)
		return this.etcdServer.get(this.tasksPath + '/' + taskId.replace(/^task:/, ""), {}).then(pick_value)
	},

	report: function() {
		var etcd = this.etcdServer,
			taskBasePath = this.tasksPath,
			clientPath = this.nodesPath + '/' + this.nodeAddr;
		return etcd.get(clientPath, {}).then(function(result) {
			Object.keys(new Objectify(result.body.node)).forEach(function(id) {
				etcd.get(taskBasePath + '/' + id, {}).then(function(result) {
					console.log('==> '+id)
					console.log(JSON.stringify(JSON.parse(pick_value(result)), null, '\t'))
				})
			})
		})
	}
}

module.exports = TaskCenter;