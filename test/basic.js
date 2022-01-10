const test = require('brittle')
const ram = require('random-access-memory')

const Hypercore = require('../')
const { create } = require('./helpers')

test('basic', async function (t) {
  const core = await create()
  let appends = 0

  t.is(core.length, 0)
  t.is(core.byteLength, 0)
  t.is(core.writable, true)
  t.is(core.readable, true)

  core.on('append', function () {
    appends++
  })

  await core.append('hello')
  await core.append('world')

  t.is(core.length, 2)
  t.is(core.byteLength, 10)
  t.is(appends, 2)

  t.end()
})

test('session', async function (t) {
  const core = await create()

  const session = core.session()

  await session.append('test')
  t.alike(await core.get(0), Buffer.from('test'))
  t.alike(await session.get(0), Buffer.from('test'))
  t.end()
})

test('close', async function (t) {
  const core = await create()
  await core.append('hello world')

  await core.close()

  try {
    await core.get(0)
    t.fail('core should be closed')
  } catch {
    t.pass('get threw correctly when core was closed')
  }
})

test('close multiple', async function (t) {
  const core = await create()
  await core.append('hello world')

  const ev = t.test('events')

  ev.plan(4)

  let i = 0

  core.on('close', () => ev.is(i++, 0, 'on close'))
  core.close().then(() => ev.is(i++, 1, 'first close'))
  core.close().then(() => ev.is(i++, 2, 'second close'))
  core.close().then(() => ev.is(i++, 3, 'third close'))

  await ev
})

test('storage options', async function (t) {
  const core = new Hypercore({ storage: ram })
  await core.append('hello')
  t.alike(await core.get(0), Buffer.from('hello'))
  t.end()
})

test(
  'allow publicKeys with different byteLength that 32, if opts.crypto were passed',
  function (t) {
    const key = Buffer.alloc(33).fill('a')

    const core = new Hypercore(ram, key, { crypto: {} })

    t.is(core.key, key)
    t.pass('creating a core with more than 32 byteLength key did not throw')
  }
)

test('createIfMissing', async function (t) {
  const core = new Hypercore(ram, { createIfMissing: false })

  t.exception(core.ready())
})

test('reopen and overwrite', async function (t) {
  const st = {}
  const core = new Hypercore(open)

  await core.ready()
  const key = core.key

  const reopen = new Hypercore(open)

  await reopen.ready()
  t.alike(reopen.key, key, 'reopened the core')

  const overwritten = new Hypercore(open, { overwrite: true })

  await overwritten.ready()
  t.unlike(overwritten.key, key, 'overwrote the core')

  function open (name) {
    if (st[name]) return st[name]
    st[name] = ram()
    return st[name]
  }
})

test('truncate event has truncated-length and fork', async function (t) {
  t.plan(2)

  const core = new Hypercore(ram)

  core.on('truncate', function (length, fork) {
    t.is(length, 2)
    t.is(fork, 1)
  })

  await core.append(['a', 'b', 'c'])
  await core.truncate(2)
})
