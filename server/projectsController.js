const has = require('lodash/has')
const projectsFileHelper = require('./projectsFileHelper')
const modelController = require('./modelController')
const errorHandler = require('./errorHandler')

const PROPERTIES = ['name', 'tasks.defined', 'tasks.quick']

let projects = []

const verifyCorrectStructure = (project) => {
    let isCorrect = true
    PROPERTIES.forEach((property) => {
        if (!has(project, property)) {
            isCorrect = false
        }
    })

    return isCorrect
}

const constructProjects = () => {
    const loadedProjects = projectsFileHelper.constructProjects()

    projects = loadedProjects.reduce((projects, project) => {
        const isCorrect = verifyCorrectStructure(project)
        if (isCorrect) {
            projects.push(project)
        } else {
            errorHandler.error(`WARNING! Project ${project.name || ''} has invalid structure.`)
        }
        return projects
    }, [])

    return projects
}

const getProject = (filters) => {
    return modelController.getElement(projects)(filters)
}

const getDefinedTask = (projectFilters) => (taskFilters) => {
    return modelController.getElement(getDefinedTasks(projectFilters))(taskFilters, {})
}

const getDefinedTasks = (filters) => {
    const project = getProject(filters)
    return modelController.getPart(project)('tasks.defined', [])
}

const getQuickTasks = (filters) => {
    const project = getProject(filters)
    return modelController.getPart(project)('tasks.quick', [])
}

module.exports = {
    constructProjects,
    getProject,
    getDefinedTasks,
    getDefinedTask,
    getQuickTasks
}
