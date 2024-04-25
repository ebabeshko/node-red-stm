module.exports = function(RED) {
    function STM_DIAG(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function(msg) {

            var ffi = require('ffi-napi');
            var ref = require('ref-napi');
            var int32 = ref.types.int32;

            // stmdsrce.dll must be in PATH
            var libstmapi = ffi.Library('stmdsrce.dll', {
                _AttachDataSource: ['bool', []],
                _DetachDataSource: [ref.types.void, []],
                _GetPortHandle: ['int32', ['int32']],
                _GetDevHandleBySno: ['int32', ['int32']],
                _IsPortOn: ['bool', ['int32']],
                _IsDevOnLine: ['bool', ['int32']]
            });

            var attached = libstmapi._AttachDataSource();
            if (attached) {
                var diagobject = (config.diagobject == "Device" ? 1 : 0);
                var address = config.address - 1;
                if (diagobject == 1) {
                    address = config.address;
                    var d = libstmapi._GetDevHandleBySno(address);
                    if (d == -1) {
                        node.error("STM-DIAG: Device not found");
                    } else {
                        msg.payload = libstmapi._IsDevOnLine(d);
                    }

                } else {
                    var p = libstmapi._GetPortHandle(address);
                    if (p == -1) {
                        node.error("STM-DIAG: Port not found");
                    } else {
                        msg.payload = libstmapi._IsPortOn(p);
                    }
                }
                node.send(msg);
                libstmapi._DetachDataSource();
            } else {
                node.error("STM-DIAG: Not attached to data source");
            }
        });
    }

    RED.nodes.registerType("stm-diag", STM_DIAG);
};
