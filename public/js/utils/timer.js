let timer = {
  intervals: new Set(),

  start(...args) {
    const newInterval = setInterval(...args)
    this.intervals.add(newInterval)
    return newInterval
  },

  clear(id) {
    this.intervals.delete(id);
    return clearInterval(id)
  },

  clearAll() {
    for (const id of this.intervals) {
      this.clear(id)
    }
  }
}

export default startTimer = (time, callback)=>{
  let elapsedTime = time

  timer.start(()=> {
    timerDisplay.innerText = elapsedTime
    elapsedTime--
    if(elapsedTime < 0) {
      timer.clearAll()
      callback()
    }
  }, 1000)

}