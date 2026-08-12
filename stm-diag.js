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
            _IsDevOnLine: ['bool', ['int32']],
            _GetPortStat: ['int32', ['int32', 'int32']]
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
                }
                else {
                    msg.payload = libstmapi._IsDevOnLine(d);
                }

            }
            else {
                var p = libstmapi._GetPortHandle(address);

                if (p == -1) {
                    node.error("STM-DIAG: Port not found");
                }
                else {
                    msg.payload = libstmapi._IsPortOn(p);
                    msg.portstatus = msg.payload ? libstmapi._GetPortStat(p, 4) : -1;

                    const statusText = {
                        "-1": "OFF",
                        "0": "Rx...",
                        "1": "Opening...",
                        "2": "Connecting...",
                        "3": "Tx...",
                        "4": "Closing...",
                        "6": "Port Error",
                        "7": "Configuration Error"
                    };

                    const nodeContext = node.context();

                    const currentStatus = msg.portstatus;
                    const currentText = statusText[String(currentStatus)] ?? "Unknown";

                    if (config.showportnumber || config.showportstatus) {
                        let fill = "grey";

                        if (currentStatus === 0 || currentStatus === 3) {
                            fill = "green";
                        }
                        else if (currentStatus === 6 || currentStatus === 7) {
                            fill = "red";
                        }

                        let statusText = "";

                        if (config.showportnumber) {
                            statusText += "Port " + config.address;
                        }

                        if (config.showportstatus) {
                            if (statusText !== "") {
                                statusText += ": ";
                            }
                            statusText += currentText;
                        }

                        node.status({
                            fill: fill,
                            shape: "dot",
                            text: statusText
                        });
                    }

                    const previousStatus = nodeContext.get("portstatus");

                    if (previousStatus !== currentStatus) {
                        if (previousStatus !== undefined) {

                            if (currentStatus === 0 || currentStatus === 3) {
                                node.log(
                                    "Port " + config.address +
                                    ": " + currentText
                                );
                            }
                            else {
                                node.warn(
                                    "Port " + config.address +
                                    ": " + currentText
                                );
                            }
                        }

                        nodeContext.set("portstatus", currentStatus);
                    }
                }
            }

            node.send(msg);
            libstmapi._DetachDataSource();
        }
        else {
            node.error("STM-DIAG: Not attached to data source");
        }
    });
}

RED.nodes.registerType("stm-diag", STM_DIAG);
};