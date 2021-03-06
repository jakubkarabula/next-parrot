const { spawn }  = require('child_process')
const readline      = require('readline');
const pidusage = require('pidusage')
const constants = require('../../shared/constants')
const errorHandler = require('../logging/errorHandler')
const modelController = require('./modelController')
const messagesHandler = require('../logging/messagesHandler')
const verifyTask = require('../tasks/verifyTask').default
const uuidv4 = require('uuid/v4');
const os = require('os');
const find = require('lodash/find');

const processes = []
const std_out = {}
const std_err = {}

const listProcesses = () => {
    processes.forEach((process) => {
        pidusage(process.pid, (error, stats) => {
            if (!error) {
                process.stats = stats
            }
        })
    })

    messagesHandler.processes(constants.PROCESSES_LIST, processes)

    // setInterval(() => {
    //     processes.forEach((process) => {
    //         pidusage(process.pid, (error, stats) => {
    //             if (!error) {
    //                 process.stats = stats
    //             }
    //         })
    //     })

    //     messagesHandler.processes(constants.PROCESSES_LIST, processes)
    // }, 5000)
}

const shareSTDOUT = () => {
    messagesHandler.processes(constants.STDOUT_LIST, std_out)
}

const shareSTDERR = () => {
    messagesHandler.processes(constants.STDERR_LIST, std_err)
}

const killProcess = (id) => {
    const proc = find(processes, { id })
    proc && process.kill(proc.pid)
}

const rerunProcess = (id) => {
    const proc = find(processes, { id })

    if (proc) {
        prepareProcess(proc)
    } else {
        errorHandler.error('ERROR! Process was not found.')
    }
}

const prepareProcess = async (config) => {
    const { project_id, type } = config

    console.log('got this config', config)

    const task = verifyTask(config)

    console.log('got this task', config, task)

    if (!task) {
        return false
    }

    if (type === 'queue') {
        const { tasks, id: queue_id, parallel, pipe } = task
        const queue_uuid = uuidv4()
        let lastPid = null

        for (subTask of tasks) {
            const contexedTask = verifyTask({ project_id, queue_id, queue_uuid, ...subTask })

            if (contexedTask) {
                if (parallel) {
                    runProcess(contexedTask)
                } else {
                    const waitForProc = () => new Promise((resolve, reject) => {
                        const callbacks = {
                            onCloseCallback: () => resolve()
                         }

                        const child = runProcess(contexedTask, callbacks)

                        // if (pipe && lastPid && std_out[lastPid]) {
                        //     const messages = std_out[lastPid].join(os.EOL)
                        //     child.proc.stdin.write(messages)
                        // }

                        lastPid = child.proc.pid
                    })
                    await waitForProc()
                }
            }
        }
    } else {
        runProcess(task)
    }
}

const runProcess = (task, callbacks = {}) => {
    console.log(task)

    const { task_id, project_id, type, env_params, command, cwd, args, queue_id, queue_uuid, parent_pid, hooks } = task

    const env = { ...process.env, ...env_params };
    let proc;

    proc = spawn(command, args, { env, cwd } );

    proc.on('error', (error) => {
        errorHandler.error('ERROR! Process was not started! Message: ' + error.toString())
    })
    if (!proc.pid) {
        return false
    }

    const procData = {
        id: uuidv4(),
        task_id,
        project_id,
        queue_id,
        queue_uuid,
        parent_pid,
        type,
        pid: proc.pid,
        cwd,
        args,
        env_params,
        status: constants.PROCESS_STARTED,
        started_at: +Date.now(),
        updated_at: +Date.now()
    }

    messagesHandler.processes(constants.START_PROCESS, { pid: proc.pid, data: '[PROCESS HAS STARTED]\n', time: +Date.now() })
    messagesHandler.processes(constants.PROCESSES_LIST, processes)

    const checkUsersHooks = (data) => {
        if (hooks) {
            hooks.forEach((hook) => {
                const isValid = hook.regex ? RegExp(hook.pattern).test(data) : data.includes(hook.pattern)

                if (isValid) {
                    if (hook.status) {
                        procData.status = hook.status
                        procData.updated_at = +Date.now()
                        messagesHandler.processes(constants.PROCESSES_LIST, processes)
                    }
                    if (hook.action) {
                        const { action } = hook
                        prepareProcess({ ...action, project_id, parent_pid: proc.pid })
                    }
                }
            })
        }
    }

    proc.stdout.on('data', (buffer) => {
        const data = buffer.toString()

        procData.updated_at = +Date.now()
        messagesHandler.processes(constants.STDOUT, { pid: proc.pid, data: data, time: +Date.now() })

        if (callbacks.stdoutCallback) {
            callbacks.stdoutCallback(data)
        }

        checkUsersHooks(data)

        if (std_out[proc.pid]) {
            std_out[proc.pid].push(data)
        } else {
            std_out[proc.pid] = [data]
        }
        messagesHandler.processes(constants.PROCESSES_LIST, processes)
    } );

    proc.stderr.on('data', (buffer) => {
        const data = buffer.toString()

        procData.updated_at = +Date.now()
        messagesHandler.processes(constants.STDERR, { pid: proc.pid, data: data.toString(), time: +Date.now() })

        if (callbacks.stderrCallback) {
            callbacks.stderrCallback(data)
        }

        checkUsersHooks(data)

        if (std_err[proc.pid]) {
            std_err[proc.pid].push(data)
        } else {
            std_err[proc.pid] = [data]
        }

        messagesHandler.processes(constants.PROCESSES_LIST, processes)
    });

    proc.on('close', (data) => {
        messagesHandler.processes(constants.PROCESS_FINISHED, { pid: proc.pid, data: `[PROCESS HAS STOPPED WITH STATUS: ${data}]\n`, time: +Date.now() })

        procData.status = constants.PROCESS_FINISHED
        procData.updated_at = +Date.now()

        if (callbacks.onCloseCallback) {
            callbacks.onCloseCallback(data, proc.pid)
        }
        messagesHandler.processes(constants.PROCESSES_LIST, processes)
    });

    processes.push(procData)
    messagesHandler.processes(constants.PROCESSES_LIST, processes)

    return { procData, proc }
}

module.exports = ({
    runProcess,
    prepareProcess,
    shareSTDOUT,
    shareSTDERR,
    listProcesses,
    rerunProcess,
    killProcess,
})
