
// development server on 5000
// development client-side on 3000
// client side code

const socket = io('/')
const videoGrid = document.getElementById('video-grid');

// id must start and end with alphanumeric character
// dashes and underscores are allowed
const peer = new Peer(undefined, {
  host: '/',
  port: '3001' //server and client exists on different ports
  // pingInterval: 5000
  // path: '/'
  // secure: true if SSL
  // config
  // debug: 0 => prints no logs (3 prints all logs)
})

const peers = {}
const myVideo = document.createElement('video')
// mutes your own microphone output to yourself
myVideo.muted = true;

// navigator.getUserMedia(constraints, successCallback, errorCallback);
navigator.mediaDevices.getUserMedia({
  video: true, //can pass in dimensions e.g. {width: 1280, height: 720}
  audio: true
}).then(stream=> {

  // audio analyser
  const colorPids = (vol)=> {
    let all_pids = [...document.querySelectorAll('.pid')];
    let amount_of_pids = Math.round(vol/10);
    let elem_range = all_pids.slice(0, amount_of_pids)
    for (var i = 0; i < all_pids.length; i++) {
      all_pids[i].style.backgroundColor="#e6e7e8";
    }
    for (var i = 0; i < elem_range.length; i++) {
      // console.log(elem_range[i]);
      elem_range[i].style.backgroundColor="#69ce2b";
    }
  }
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  microphone = audioContext.createMediaStreamSource(stream);
  javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

  analyser.smoothingTimeConstant = 0.8;
  analyser.fftSize = 1024;

  microphone.connect(analyser);
  analyser.connect(javascriptNode);
  javascriptNode.connect(audioContext.destination);
  javascriptNode.onaudioprocess = function() {
      var array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      var values = 0;

      var length = array.length;
      for (var i = 0; i < length; i++) {
        values += (array[i]);
      }

      var average = values / length;

    colorPids(average);
    }

  addVideoStream(myVideo,stream)

// Set listeners for peer events.
// peer.on(event, callback);
// Emitted when a remote peer attempts to call you. The emitted mediaConnection is not yet active; you must first answer the call (mediaConnection.answer([stream]);). Then, you can listen for the stream event.
  peer.on('call', mediaConnection => {
    mediaConnection.answer(stream)
    const video = document.createElement('video')

    // `stream` is the MediaStream of the remote peer.
    mediaConnection.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  })

  // after new user joins room, get new user stream
  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  })
})

socket.on('user-disconnected', userId=> {
  if(peers[userId]) peers[userId].close();
})

// Emitted when a connection to the PeerServer is established. You may use the peer before this is emitted, but messages to the server will be queued. id is the brokering ID of the peer (which was either provided in the constructor or assigned by the server).
peer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

const addVideoStream = (video,stream)=> {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', ()=> {
    video.play();
  })
  videoGrid.append(video)
}

const connectToNewUser = (userId, stream) => {
  // Calls the remote peer specified by id and returns a media connection. Be sure to listen on the error event in case the connection fails.
  // const mediaConnection = peer.call(id, stream, [options]);
  const call = peer.call(userId, stream);
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video,userVideoStream)
  })
  call.on('close', ()=> {
    video.remove();
  })

  peers[userId] = call;
  console.log(call)
}