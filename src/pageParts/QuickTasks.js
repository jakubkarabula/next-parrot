import React from 'react';
import { connect } from 'react-redux'
import DescriptionIcon from '@material-ui/icons/Description'
import { getCurrentQuickTasks, getCurrentProjectId } from '../../redux/selectors'
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import { withStyles } from '@material-ui/core/styles';
import FlashIcon from '@material-ui/icons/FlashOn'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBolt, faFileAlt, faTimes } from '@fortawesome/free-solid-svg-icons'
import { addTab, removeTab } from '../../redux/actions'
const uuidv4 = require('uuid/v4');

import constants from '../../shared/constants'
import SimpleTable from '../components/Table'
import SocketContext from '../wrappers/sockets/socketContext'

import TaskDescription from './TaskDescription'

const styles = {}

class QuickTasks extends React.Component {
    prepareTask = (task) => {
        const data = {
            type: 'quick',
            task_id: task.id,
            project_id: this.props.currentProjectId
        }

        this.props.socket.emit(constants.START_PROCESS, data)
    }

    prepareData = (data) => {
        return data.map(
            (row) => {
                row.commandWithArgs = row.command + ' ' + (row.args || []).join(' ')
                return Object.assign({}, row)
            }
        )
    }

    render() {
        const data = this.prepareData(this.props.tasks || [])

        return (
            <SimpleTable
                heads={[
                    { label: 'Name', id: 'name' },
                    { label: 'Command with Arguments', id: 'commandWithArgs' },
                    { label: '', id: 'actions', align: 'right', renderer: (val, row) => {
                    return (
                        <div>
                            <IconButton
                                onClick={() => this.prepareTask(row)}
                            >
                                 <FontAwesomeIcon
                                    icon={faBolt}
                                    style={{ width: 17, height: 17 }}
                                />
                            </IconButton>
                            <IconButton
                                onClick={() => {
                                    const uuid = uuidv4()
                                    this.props.addTab({
                                        id: uuid,
                                        label: (
                                            <div>
                                                <span>
                                                {row.name}
                                                <FontAwesomeIcon
                                                    icon={faTimes}
                                                    style={{ marginLeft: '10px' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        this.props.removeTab(uuid)
                                                    }}
                                                />
                                                </span>
                                                <span style={{ display:'block', fontSize:'9px' }}>
                                                    description
                                                </span>
                                            </div>
                                        ),
                                        view: <TaskDescription data={row} />
                                    })}
                                }
                                style={{ padding: 8 }}
                            >
                                <FontAwesomeIcon
                                    icon={faFileAlt}
                                    style={{ width: 17, height: 17 }}
                                />
                            </IconButton>
                        </div>
                    )
                    }}
                ]}
                data={data}
            />
        )
    }
}

const mapStateToProps = (state) => ({
    tasks: getCurrentQuickTasks(state),
    currentProjectId: getCurrentProjectId(state)
})

const mapDispatchToProps = dispatch => ({
    addTab: (tab) => dispatch(addTab(tab)),
    removeTab: (uuid) => dispatch(removeTab(uuid))
})

const ConnectedComponent = connect(mapStateToProps, mapDispatchToProps)(withStyles(styles)(QuickTasks))

const ContextedComponent = props => (
    <SocketContext.Consumer>
        {socket => <ConnectedComponent {...props} socket={socket} />}
    </SocketContext.Consumer>
)

export default ContextedComponent
