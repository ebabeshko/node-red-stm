module.exports = function (RED) {

    function STM_WRITE(config) {

        RED.nodes.createNode(this, config);
        const node = this;

        node.on("input", function (msg) {

            let attached = false;
            let libstmapi;

            try {

                const ffi = require("ffi-napi");

                libstmapi = ffi.Library(
                    "stmdsrce.dll",
                    {
                        _AttachDataSource: ["bool", []],

                        _DetachDataSource: ["void", []],

                        _SetTmValue: [
                            "bool",
                            [
                                "int32",
                                "int32",
                                "int32",
                                "pointer",
                                "uchar",
                                "bool"
                            ]
                        ],

                        _GetDevHandleBySno: [
                            "int32",
                            ["int32"]
                        ],

                        _GetBlockHandle: [
                            "int32",
                            ["int32", "int32"]
                        ],

                        _SetBtime: [
                            "uint32",
                            [
                                "int32",
                                "int32",
                                "pointer"
                            ]
                        ],
                        _SetBpactime: [
                            "uint32",
                            [
                                "int32",
                                "int32",
                                "uint32"
                            ]
                        ],
                    }
                );

                attached = libstmapi._AttachDataSource();

                if (!attached) {
                    node.error("STM-WRITE: Not attached to data source", msg);
                    return;
                }

                const payload = msg.payload || {};

                const kpn = parseInt(
                    payload.hasOwnProperty("kp") ? payload.kp : config.kp
                );

                kpn =(kpn << 16) >> 16;

                const bn = parseInt(
                    payload.hasOwnProperty("bn") ? payload.bn : config.bn
                );

                const idx = parseInt(
                    payload.hasOwnProperty("idx")
                        ? payload.idx
                        : (config.idx || 1)
                );

                let value = payload.value;

                if (value === undefined) {
                    value = payload.NewLimit;
                }

                if (value === undefined) {
                    value = config.val;
                }

                if (
                    value === undefined || String(value).trim() === "" || Number.isNaN(Number(value))) {
                    node.error("STM-WRITE: Value is not specified", msg);
                    return;
                }

                const buf = Buffer.alloc(4);
                buf.writeInt32LE(parseInt(value));

                const kpidx = libstmapi._GetDevHandleBySno(kpn);

                if (kpidx < 0) {
                    node.error("STM-WRITE: GetDevHandleBySno returned DATASRC_DEV_ERROR", msg);
                    return;
                }

                const bidx = libstmapi._GetBlockHandle(kpidx, bn);

                if (bidx < 0) {
                    node.error("STM-WRITE: GetBlockHandle returned DATASRC_BLOCK_ERROR", msg);
                    return;
                }

                const ok_value = libstmapi._SetTmValue(
                    kpidx,
                    bidx,
                    idx - 1,
                    buf,
                    4,
                    true
                );

                if (!ok_value) {
                    node.error("STM-WRITE: SetTmValue failed", msg);
                    return;
                }

                const btime = Buffer.alloc(6);

                var dt = new Date();

		btime.writeUInt32LE(Math.floor(dt.getTime() / 1000), 0);
		btime.writeUInt16LE(dt.getMilliseconds(), 4);

		const ok_btime = libstmapi._SetBtime(
                    kpidx,
                    bidx,
                    btime
                );

                if (ok_btime === 0) {
                    node.error("STM-WRITE: SetBtime failed", msg);
                    return;
                }

                const pactime = Math.floor(dt.getTime() / 1000);

                const res = libstmapi._SetBpactime(
                    kpidx,
                    bidx,
		    pactime
                );

                if (res !== pactime) {
                    node.error("STM-WRITE: SetBpactime failed ("+pactime+")", msg);
                    return;
                }

                node.send(msg);

            } catch (err) {

                node.error("STM-WRITE Exception: " + err.message, msg);

            } finally {

                if (attached && libstmapi) {
                    libstmapi._DetachDataSource();
                }

            }

        });

    }

    RED.nodes.registerType("stm-write", STM_WRITE);

};