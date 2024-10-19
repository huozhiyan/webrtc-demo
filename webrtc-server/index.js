const socket = require("socket.io")
const http = require("http")

const server = http.createServer()

const io = socket(server, {
    cors: {
        origin: '*' // 配置跨域
    }
})

io.on("connection", sock => {
    console.log("连接成功...");
    // 向客户端发送连接成功的信息
    sock.emit("connectionSuccess");

    // 监听加入房间的事件
    sock.on("joinRoom", (roomId) => {
        sock.join(roomId);
    })

    // 发起视频，同房间全部广播
    sock.on("callRemote", (roomId) => {
        io.to(roomId).emit("callRemote")
    })

    // 接收视频，同房间全部广播
    sock.on("acceptCall", (roomId) => {
        io.to(roomId).emit("acceptCall")
    })

    // 接收 offer，同房间全部广播
    sock.on("sendOffer", ({ offer, roomId }) => {
        io.to(roomId).emit("sendOffer", offer)
    })

    // 接收 answer，同房间全部广播
    sock.on("sendAnswer", ({ answer, roomId }) => {
        io.to(roomId).emit("sendAnswer", answer)
    })

    // 接收 candidate 信息，同房间全部广播
    sock.on("sendCandidate", ({ roomId, candidate }) => {
        io.to(roomId).emit("sendCandidate", candidate)
    })

    // 挂断视频信息，同房间全部广播
    sock.on("hangUpCall", (roomId) => {
        io.to(roomId).emit("hangUpCall")
    })
})

// 监听 3000 端口
server.listen(3000, () => {
    console.log("服务器启动成功");
})