// -------------------------------------------------------------------------------------------------------
// init at local, upgrade me as dispatcher node of n4c cluster
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.09
//
// assign right of dispatcher node
// -------------------------------------------------------------------------------------------------------

var ResourceCenter = require('../infra/ResourceCenter.js')

// taskObject as configurations of per-instance
//	*) @see default_config in ResourceCenter.js
var taskObject = {
	systemName: 'sandpiper',
	serverAddr: '127.0.0.1:3232',
	// groupBasePath: '/com.wandoujia.n4c/sandpiper/nodes',
	promised: function(taskResult) {
		return {
			resource_status_center: new ResourceCenter(taskResult)
		}
	}
}

module.exports = taskObject;