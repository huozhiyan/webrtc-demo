<script setup lang="ts">
import { ref, onMounted } from "vue"
import { io, Socket } from 'socket.io-client'

// 房间号
const roomId = "001"

// 是否是接收方
const called = ref<boolean>(false)
// 是否是发起方
const caller = ref<boolean>(false)
// 呼叫中
const calling = ref<boolean>(false)
// 视频通话中
const communicating = ref<boolean>(false)
// video 标签实例，播放本人的视频
const localVideo = ref<HTMLVideoElement>()
// video 标签实例，播放对方的视频
const remoteVideo = ref<HTMLVideoElement>()
// socket 实时通信
const socket = ref<Socket>()
const peer = ref<any>()
// 本地音视频流
const localStream = ref<any>()

// 页面挂载时建立多个 websocket 连接
onMounted(() => {
  const sock = io("http://localhost:3000")

  // 连接成功
  sock.on("connectionSuccess", () => {
    console.log("连接成功...")
    // 向服务器发送一个加入房间的事件
    sock.emit("joinRoom", roomId)
  })

  // 发起通话
  sock.on("callRemote", () => {
    // 不是发送方才处理
    if (!caller.value) {
      called.value = true; // 接听方
      calling.value = true; // 视频通话中
    }
  })

  // 接收通话
  sock.on("acceptCall", async() => {
    // 发送方收到接收方的接收请求
    if (caller.value) {
      // RTCPeerConnection 的作用是在本地端和远程对等端之间建立 WebRTC 连接
      peer.value = new RTCPeerConnection()
      // 添加本地音视频流，生成 offer
      peer.value.addStream(localStream.value)

      // 通过监听 onicecandidate 事件获取 candidate 信息
      peer.value.onicecandidate = (event) => {
        console.log('发起方的 candidate 信息', event.candidate)
        if (event?.candidate) {
          // 向服务端发送 candidate 信息
          socket.value?.emit("sendCandidate", { roomId, candidate: event.candidate })
        }
      }

      // 监听 onaddstream 来获取对方的音视频流
      peer.value.onaddstream = (event) => {
        console.log("发起方收到接收方的 stream", event.stream)
        communicating.value = true
        calling.value = false
        remoteVideo.value!.srcObject = event.stream
        remoteVideo.value!.play()
      }

      // 生成 offer
      const offer = await peer.value.createOffer({
        offerToReceiveAudio: 1, // 控制是否向远程对等方提供尝试发送音频的机会
        offerToReceiveVideo: 1 // 控制是否向远程对等方提供尝试发送视频的机会
      })

      console.log('offer', offer)

      // 在本地设置 offer 信息
      peer.value.setLocalDescription(offer)
      // 发送 offer
      socket.value?.emit("sendOffer", { offer, roomId })
    }
  })

  // 接收 offer
  sock.on("sendOffer", async (offer) => {
    // 接收端
    if (called.value) {
      console.log("收到 offer", offer)
      // 创建自己的 RTCPeerConnection()
      peer.value = new RTCPeerConnection()
      // 添加本地音视频流
      const stream = await getLocalStream()
      peer.value.addStream(stream)

      // 通过监听 onicecandidate 事件获取 candidate 信息
      peer.value.onicecandidate = (event) => {
        if (event.candidate) {
          socket.value?.emit("sendCandidate", { roomId, candidate: event.candidate })
        }
      }

      // 接收方收到发起方的 stream
      peer.value.onaddstream = (event) => {
        console.log("接收方收到发起方的stream", event.stream)
        communicating.value = true
        calling.value = false
        remoteVideo.value!.srcObject = event.stream
        remoteVideo.value!.play()
      }

      // 设置远端的描述信息
      await peer.value.setRemoteDescription(offer)
      // 生成 answer
      const answer = await peer.value.createAnswer()
      console.log('发送answer', answer)
      // 在本地设置 offer 信息
      peer.value.setLocalDescription(answer)
      // 发送 offer
      sock?.emit("sendAnswer", { answer, roomId })
    }
  })

  // 发起方接收 answer
  sock.on("sendAnswer", async (answer) => {
    if (caller.value) {
      console.log('接收answer', answer)
      peer.value.setRemoteDescription(answer)
    }
  })

  // 接收 candidate 信息
  sock.on("sendCandidate", async (candidate) => {
    console.log("收到candidate信息", candidate)
    await peer.value?.addIceCandidate(candidate)
  })

  // 挂断视频
  sock.on("hangUpCall", async () => {
    localVideo.value!.srcObject = null
    remoteVideo.value!.srcObject = null
    localVideo.value!.pause()
    remoteVideo.value!.pause()

    caller.value = false
    calling.value = false
    called.value = false
    communicating.value = false
  })

  socket.value = sock
})

// 发起方发起视频请求
const callRemote = async() => {
  console.log("发起视频");

  // 发起视频请求
  caller.value = true; // 当前用户是发起方
  calling.value = true; // 呼叫中

  // 获取本地媒体流，在网页中显示摄像头当前录制的内容
  await getLocalStream()

  socket.value?.emit("callRemote", roomId)
}

// 接收方同意视频请求
const acceptCall = () => {
  console.log("同意视频邀请");
  // 发送接听视频事件
  socket.value?.emit("acceptCall", roomId)
}

// 挂断视频
const hangUp = () => {
  console.log("挂断视频");
  socket.value?.emit("hangUpCall", roomId)
}

// 获取本地音视频流，请求媒体输入许可，当用户同意后开启摄像头并把媒体流在网页中播放
const getLocalStream = async () => {
  // 获取音视频流
  // MediaDevices.getUserMedia() 会提示用户给予使用媒体输入的许可，媒体输入会产生一个MediaStream，里面包含了请求的媒体类型的轨道
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true, // 音频
    video: true // 视频
  })

  // HTMLMediaElement 接口的 srcObject 属性设定或返回一个对象，这个对象提供了一个与 HTMLMediaElement 关联的媒体源
  localVideo.value!.srcObject = stream
  // 尝试播放媒体
  localVideo.value!.play()

  localStream.value = stream

  return stream
}

</script>

<template>
  <div class="flex items-center flex-col text-center p-12 h-screen">
    <div class="bg-indigo-500 px-4 py-2 mb-5 text-sm font-semibold text-white">WebRTC——从0至1打造实时音视频通话 (By_前端杂货铺)</div>
    <div class="relative h-full mb-4">
      <!--发起方视频 -->
      <video
        ref="localVideo"
        class="w-96 h-full bg-gray-200 mb-4 object-cover"
      ></video>
      <!--接收方视频 -->
      <video
          ref="remoteVideo"
          class="w-32 h-48 absolute bottom-0 right-0 object-cover"
      ></video>
      <!--发起方在发起状态时显示 -->
      <div v-if="caller && calling" class="absolute top-2/3 left-36 flex flex-col items-center">
        <p class="mb-4 text-white">等待对方接听...</p>
        <img @click="hangUp" src="../src/assets/挂断.svg" class="w-16 cursor-pointer" alt="" />
      </div>
      <!--接收方在发起方发起时显示 -->
      <div v-if="called && calling" class="absolute top-2/3 left-36 flex flex-col items-center">
        <p class="mb-4 text-black font-semibold">收到视频邀请...</p>
        <div class="flex">
          <img @click="hangUp" src="../src/assets/挂断.svg" class="w-16 cursor-pointer mr-4" alt="" />
          <img @click="acceptCall" src="../src/assets/接听.svg" class="w-16 cursor-pointer" alt="" />
        </div>
      </div>
    </div>
    <!--发起视频/挂断视频按钮 -->
    <div class="flex gap-2 mb-4">
      <button
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        v-if="!calling && !communicating"
        @click="callRemote"
      >发起视频</button>
      <button
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          @click="hangUp"
      >挂断视频</button>
    </div>
  </div>
</template>

<style scoped>

</style>
