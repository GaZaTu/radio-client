self.onmessage = async message => {
  const { pattern, flags } = message.data

  const regex = new RegExp(pattern, flags)
  regex.exec("SOME KIND OF TEST STRING")

  self.postMessage("success")
}
