// Run after npm run build:electron:
// electron scripts/test-gopray.cjs [--live]
const { app } = require('electron')
const assert = require('node:assert/strict')

app.whenReady().then(async () => {
  try {
    const { parseGoPrayPage, fetchIqamaTimes } = require('../dist-electron/electron/services/goprayService')
    const names = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Esha']
    const times = ['5:00am', '1:30pm', '6:00pm', 'Just after athaan', '9:30pm']
    const rows = names.map((name, i) => `<tr><th>${name}</th><td>${times[i]}</td></tr>`).join('')
    const legacy = parseGoPrayPage(`<div class="place-prayer-times"><table>${rows}<tr class="jummah"><th>Jummah</th><td>1:00 pm, 1:30 pm</td></tr><tr class="tahajjud"><th>Tahajjud</th><td>11:30pm</td></tr></table></div>`)
    const modern = parseGoPrayPage(`<table><thead><tr><th>Prayer</th><th>Iqamah time</th></tr></thead><tbody>${names.map((name, i) => `<tr><td><span>${name}</span></td><td>${times[i].replace(/(am|pm)/, '<small>$1</small>')}</td></tr>`).join('')}</tbody></table><div><span>Jumu’ah<span>Friday khutbah</span></span><div>1:00<small>pm</small> /1:30<small>pm</small></div></div>`)
    assert.deepEqual(modern, legacy)
    assert.deepEqual(modern.iqama.map(p => p.name), ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'])
    assert.deepEqual(modern.jummah, { first: '1:00 PM', second: '1:30 PM' })
    assert.throws(() => parseGoPrayPage('<html>Loading...</html>'), /table not found/)
    assert.throws(() => parseGoPrayPage('<div class="place-prayer-times"><table><tr><th>Fajr</th><td>5:00am</td></tr></table></div>'), /all five/)
    console.log('PASS: legacy/new layouts, Friday sessions, missing and incomplete tables')
    if (process.argv.includes('--live')) {
      const result = await fetchIqamaTimes()
      assert.equal(result.iqama.length, 5)
      console.log('LIVE:', JSON.stringify(result))
    }
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
