// 为什么：内置通知插件模板；在 stop 钩子触发时发送系统通知（依赖 terminal-notifier）。
const { exec } = require('child_process')
const path = require('path')

const plugin = {
  name: 'notify-plugin',

  stop: async (opts) => {
    const cwd = process.cwd()
    const folderName = path.basename(cwd)

    // 获取最后一条回复的文本，截取前100个字符
    let lastMessage = opts.result?.data?.text || '对话完成'
    if (lastMessage.length > 100) {
      lastMessage = lastMessage.substring(0, 100) + '...'
    }
    // 转义双引号，避免命令注入
    lastMessage = lastMessage.replace(/"/g, '\\"').replace(/\n/g, ' ')

    exec(
      `terminal-notifier -title "Neovate - ${folderName}" -message "${lastMessage}" -activate com.googlecode.iterm2 -sound default`
    )
  },
}

module.exports = plugin
