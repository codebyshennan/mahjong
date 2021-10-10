
import { collection, getDocs, doc, getDoc, setDoc, getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, serverTimestamp as fsServerTimestamp, writeBatch} from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'
import {fsdb} from './game.js'

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }
  ],
  iceCandidatePoolSize: 10,
}

const pc = new RTCPeerConnection(servers)
let localStream = null;
let remoteStreams = [new MediaStream(),new MediaStream(),new MediaStream()]

const remoteVideo2 = document.getElementById('rightvideo')
const remoteVideo3 = document.getElementById('topvideo')
const remoteVideo1 = document.getElementById('leftvideo')

let remoteVideos = [remoteVideo1, remoteVideo2, remoteVideo3]

const ownVideoStream = document.getElementById('mainvideo')

const audio = document.getElementById('audio')
for(let i = 0; i < 10; i++) {
  const pid = document.createElement('div')
  pid.classList.add('pid')
  audio.appendChild(pid)
}

const addVideoStream = (output, stream)=> {
  const video = document.createElement('video')
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', ()=> {
    video.play();
  })
  output.append(video)
}

// navigator.getUserMedia(constraints, successCallback, errorCallback);
localStream = await navigator.mediaDevices.getUserMedia({
  video: true, //can pass in dimensions e.g. {width: 1280, height: 720}
  audio: true
})

localStream.getTracks().forEach((track)=> {
  pc.addTrack(track, localStream)
})

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

const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
const microphone = audioContext.createMediaStreamSource(localStream);
const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

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
let counter=0
pc.ontrack = (event) => {
  console.log(event.streams)
  event.streams.forEach(stream=> {
    stream.getTracks().forEach((track)=>{
      remoteStreams[counter].addTrack(track)
    })
    addVideoStream(remoteVideos[counter],remoteStreams[counter])
    counter+=1
  })
}

addVideoStream(ownVideoStream, localStream)


// Reference Firestore collections for signaling
const callDoc = collection(fsdb,'calls');
const offerCandidates = doc(fsdb,'calls','offerCandidates');
const answerCandidates = doc(fsdb,'calls','answerCandidates');

const callerId = callDoc.id;

// Get candidates for caller, save to db
pc.onicecandidate = (event) => {
  event.candidate && setDoc(offerCandidates,event.candidate.toJSON());
};

// Create offer
const offerDescription = await pc.createOffer();
await pc.setLocalDescription(offerDescription);

const offer = {
  sdp: offerDescription.sdp,
  type: offerDescription.type,
};

await addDoc(callDoc, { offer });

// Listen for remote answer
onSnapshot(callDoc, (snapshot) => {
  const data = snapshot.data();
  if (!pc.currentRemoteDescription && data?.answer) {
    const answerDescription = new RTCSessionDescription(data.answer);
    pc.setRemoteDescription(answerDescription);
  }
});

// When answered, add candidate to peer connection
onSnapshot(answerCandidates, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      const candidate = new RTCIceCandidate(change.doc.data());
      pc.addIceCandidate(candidate);
    }
  });
});

const callNewDoc = doc(fsdb, 'calls', callerId);
const answerNewCandidates = collection(fsdb, 'calls', callerId,'answerCandidates');
const offerNewCandidates = collection(fsdb, 'calls', callerId,'offerCandidates');

pc.onicecandidate = (event) => {
  event.candidate && answerNewCandidates.add(event.candidate.toJSON());
};

const callData = (await callNewDoc.get()).data();

const offerNewDescription = callData.offer;
await pc.setRemoteDescription(new RTCSessionDescription(offerNewDescription));

const answerDescription = await pc.createAnswer();
await pc.setLocalDescription(answerDescription);

const answer = {
  type: answerDescription.type,
  sdp: answerDescription.sdp,
};

await updateDoc(callNewDoc, { answer });

onSnapshot(offerNewCandidates, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    console.log(change);
    if (change.type === 'added') {
      let data = change.doc.data();
      pc.addIceCandidate(new RTCIceCandidate(data));
    }
  });
});


