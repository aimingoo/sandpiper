echo '==============================================================='

# list registed items
echo ':: registed items in init_worker_node.js'
etcdctl ls '/com.wandoujia.n4c/sandpiper/nodes'

# list registed nodes
echo ':: registed nodes'
etcdctl ls '/com.wandoujia.n4c/sandpiper/nodes' | grep -Fe '/.'

# list execute_task interfaces
echo ':: execute_task interfaces'
etcdctl ls '/com.wandoujia.n4c/sandpiper/nodes' --recursive | egrep -Ee '/execute_task$' | xargs -n1 etcdctl get

# heartbeat
echo ':: heartbeat in init_worker_node.js'
etcdctl ls '/com.wandoujia.n4c/sandpiper/nodes' | fgrep -Fe '/.' | xargs -n1 etcdctl get

# execute_task at sandpiper
echo ':: execute_task in init_unlimit_node.js'
Worker="http://127.0.0.1:8032"
curl -s "${Worker}/sandpiper/execute_task:c2eb2597e461aa3aa0e472f52e92fe0b"

# resource query
full='/com.wandoujia.n4c/sandpiper/nodes'
basePath='/com.wandoujia.n4c'
resId=${full#${basePath}}
token=`crc32 <(echo -n "$basePath")`
ResourceCenter="http://127.0.0.1:3232"
echo
echo ':: resource query in init_resource_center.js'
curl -s "${ResourceCenter}/n4c/${token}/query?${resId}" -X GET

# resource subscribe
echo
echo ':: resource subscribe in init_resource_center.js'
subscribeData='{"receive":"http://127.0.0.1:8033/sandpiper/notify"}'
curl -s "${ResourceCenter}/n4c/${token}/subscribe?${resId}" --data-binary "$subscribeData" -X POST

# resource subscribe 2
echo
echo ':: resource subscribe at instance 2'
basePath="${full}"
resId="/"
token=`crc32 <(echo -n "$basePath")`
subscribeData='{"receive":"http://127.0.0.1:8033/sandpiper/notify2"}'
curl -s "${ResourceCenter}/n4c/${token}/subscribe?${resId}" --data-binary "$subscribeData" -X POST

echo
echo '==============================================================='
echo 'Done.'