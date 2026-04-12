import { cancelUpload, removeUpload, upload, uploadMultiple } from './features/supportFileUploads'
import { dispatch, dispatchEl, dispatchRef, dispatchSelf, dispatchTo, listen } from '@/events'
import { generateEntangleFunction } from '@/features/supportEntangle'
import { findComponentByEl } from '@/store'
import { dataGet, dataSet } from '@/utils'
import Alpine from 'alpinejs'
import { on as hook } from './hooks'
import { fireAction, setNextActionMetadata, interceptComponentAction, interceptComponentMessage, interceptComponentRequest } from '@/request'
import { getErrorsObject } from '@/features/supportErrors'
import { findRefEl } from '@/features/supportRefs'
import { checkDirty } from './directives/wire-dirty'
import { assetIsPendingFor, runAfterAssetIsLoadedFor } from './features/supportJsModules'

let properties = {}
let fallback

function wireProperty(name, callback, component = null) {
    properties[name] = callback
}

function wireFallback(callback) {
    fallback = callback
}

// For V2 backwards compatibility...
// And I actually like both depending on the scenario...
let aliases = {
    'on': '$on',
    'el': '$el',
    'id': '$id',
    'js': '$js',
    'get': '$get',
    'set': '$set',
    'refs': '$refs',
    'call': '$call',
    'hook': '$hook',
    'watch': '$watch',
    'dirty': '$dirty',
    'effect': '$effect',
    'commit': '$commit',
    'errors': '$errors',
    'island': '$island',
    'upload': '$upload',
    'entangle': '$entangle',
    'dispatch': '$dispatch',
    'intercept': '$intercept',
    'interceptAction': '$interceptAction',
    'interceptMessage': '$interceptMessage',
    'interceptRequest': '$interceptRequest',
    'dispatchTo': '$dispatchTo',
    'dispatchSelf': '$dispatchSelf',
    'dispatchEl': '$dispatchEl',
    'dispatchRef': '$dispatchRef',
    'removeUpload': '$removeUpload',
    'cancelUpload': '$cancelUpload',
    'uploadMultiple': '$uploadMultiple',
}

/**
 * @return {WireObject}
 */
export function generateWireObject(component, state) {
    let isScoped = false

    return new Proxy({}, {
        get(target, property) {
            if (property === '__instance') return component

            if (property in aliases) {
                return getProperty(component, aliases[property])
            } else if (property in properties) {
                return getProperty(component, property)
            } else if (property in state) {
                return state[property]
            } else if (property === 'toJSON') {
                // Tools like Laravel Boost call JSON.stringify() on objects
                // (e.g. for browser console logging). Without this, the Proxy
                // fallback would send "toJSON" as a server-side method call,
                // throwing a MethodNotFoundException.
                return () => component.toJSON()
            } else if (! ['then'].includes(property)) {
                return getFallback(component)(property)
            }
        },

        set(target, property, value) {
            if (property in state) {
                state[property] = value
            }

            return true
        },
    })
}

function getProperty(component, name) {
    return properties[name](component)
}

function getFallback(component) {
    return fallback(component)
}

Alpine.magic('wire', (el, { cleanup }) => {
    // Purposely initializing an empty variable here is a "memo"
    // so that a component is lazy-loaded when using $wire from Alpine...
    let component

    // Override $wire methods that need to be cleaned up when
    // and element is removed. For example, `x-data="{ foo: $wire.entangle(...) }"`:
    // we would want the entangle effect freed if the element was removed from the DOM...
    return new Proxy({}, {
        get(target, property) {
            if (! component) {
                try {
                    component = findComponentByEl(el)
                } catch (e) {
                    return () => {}
                }
            }

            if (['$entangle', 'entangle'].includes(property)) {
                return generateEntangleFunction(component, cleanup)
            }

            return component.$wire[property]
        },

        set(target, property, value) {
            if (! component) {
                try {
                    component = findComponentByEl(el)
                } catch (e) {
                    return true
                }
            }

            component.$wire[property] = value

            return true
        },
    })
})


/**
 * @typedef {{__instance: import('./component').Component}} WireObject___instance
 */
wireProperty('__instance', (component) => component);

/**
 * @template {Record<string, any>} Properties
 * @typedef {{$get: <Name extends keyof Properties|string>(property: Name, reactive: boolean) => Properties[Name]}} WireObject_$get
 */
wireProperty('$get', (component) => (property, reactive = true) => dataGet(reactive ? component.reactive : component.ephemeral, property))

/**
 * @typedef {{$el: HTMLElement}} WireObject_$el
 */
wireProperty('$el', (component) => {
    return component.el
})

/**
 * @typedef {{$id: string}} WireObject_$id
 */
wireProperty('$id', (component) => {
    return component.id
})

/**
 * @typedef {{$js: (name: string, action: (...params) => any) => void & Record<string, (...params) => any>}} WireObject_$js
 */
wireProperty('$js', (component) => {
    let fn = component.addJsAction.bind(component)

    let jsActions = component.getJsActions()

    Object.keys(jsActions).forEach((name) => {
        fn[name] = jsActions[name]
    })

    return new Proxy(fn, {
        set(target, property, value) {
            component.addJsAction(property, value)

            return true
        },
        get(target, property) {
            // Scripts in view-based components are imported dynamically,
            // which means they run asynchronously. This causes issues with
            // things like wire:text="$js.foo()" not being available on page load.
            // To patch this, we return a promise that resolves the $js action
            // after the script is fully imported and executed...
            if (assetIsPendingFor(component)) {
                let resolver = null

                let promise = new Promise((resolve) => {
                    resolver = resolve
                })

                return (...params) => {
                    runAfterAssetIsLoadedFor(component, () => {
                        resolver(component.getJsAction(property)(...params))
                    })

                    return promise
                }
            }

            return target[property]
        }
    })
})

/**
 * @template {Record<string, any>} Properties
 * @typedef {{$set: <Name extends keyof Properties|string>(property: Name, value: Properties[Name], live?: boolean) => Promise<any>}} WireObject_$set
 */
wireProperty('$set', (component) => async (property, value, live = true) => {
    dataSet(component.reactive, property, value)

    // If "live", send a request, queueing the property update to happen first
    // on the server, then trickle back down to the client and get merged...
    if (live) {
        component.queueUpdate(property, value)

        return fireAction(component, '$set')
    }

    return Promise.resolve()
})

/**
 * @typedef {{$refs: (name: string) => HTMLElement}} WireObject_$refs
 */
wireProperty('$refs', (component) => {
    let fn = (name) => findRefEl(component, name)

    return new Proxy(fn, {
        get(target, property) {
            if (property in target) {
                return target[property]
            }

            return fn(property)
        }
    })
})

/**
 * @template {Record<string, any>} Properties
 * @typedef {{$dirty: (property: keyof Properties) => boolean}} WireObject_$dirty
 */
wireProperty('$dirty', (component) => (property) => {
    let reactive = Alpine.reactive({ dirty: false })

    interceptComponentMessage(component, ({ onFinish }) => {
        onFinish(() => {
            queueMicrotask(() => {
                reactive.dirty = checkDirty(component, property)
            })
        })
    })

    Alpine.effect(() => {
        reactive.dirty = checkDirty(component, property)
    })

    return reactive.dirty
})

/**
 * @typedef {{intercept: import('./types').OmitFirstParameter<typeof import('./request').interceptComponentAction>}} WireObject_$intercept
 */
wireProperty('$intercept', (component) => (actionNameOrCallback, maybeCallback) => {
    return interceptComponentAction(component, actionNameOrCallback, maybeCallback)
})

/**
 * @typedef {{interceptAction: import('./types').OmitFirstParameter<typeof import('./request').interceptComponentAction>}} WireObject_$interceptAction
 */
wireProperty('$interceptAction', (component) => (actionNameOrCallback, maybeCallback) => {
    return interceptComponentAction(component, actionNameOrCallback, maybeCallback)
})

/**
 * @typedef {{interceptMessage: import('./types').OmitFirstParameter<typeof import('./request').interceptComponentMessage>}} WireObject_$interceptMessage
 */
wireProperty('$interceptMessage', (component) => (actionNameOrCallback, maybeCallback) => {
    return interceptComponentMessage(component, actionNameOrCallback, maybeCallback)
})

/**
 * @typedef {{interceptRequest: import('./types').OmitFirstParameter<typeof import('./request').interceptComponentAction>}} WireObject_$interceptRequest
 */
wireProperty('$interceptRequest', (component) => (actionNameOrCallback, maybeCallback) => {
    return interceptComponentRequest(component, actionNameOrCallback, maybeCallback)
})

/**
 * @template {Record<string, any>} Properties
 * @typedef {{$errors: ReturnType<typeof import('./features/supportErrors').getErrorsObject<Properties>>}} WireObject_$errors
 */
wireProperty('$errors', (component) => getErrorsObject(component))

/**
 * @template {Record<string, (...params: any) => any>} Methods
 * @typedef {{$call: <Name extends keyof Methods>(method: Name, ...params: Parameters<Methods[Name]>) => Promise<any>}} WireObject_$call
 */
wireProperty('$call', (component) => async (method, ...params) => {
    return await component.$wire[method](...params)
})

/**
 * @template {Record<string, any>} Properties
 * @template {Record<string, (...params: any) => any>} Methods
 * @typedef {{$island: (name: string, options?: { mode: 'morph'|'append' }) => WireObject<Properties, Methods>}} WireObject_$island
 */
wireProperty('$island', (component) => (name, options = {}) => {
    setNextActionMetadata({ island: { name, mode: 'morph', ...options } })

    return component.$wire
})

/**
 * @template {Record<string, any>} Properties
 * @typedef {{$entangle: (name: keyof Properties, live?: boolean) => any}} WireObject_$entangle
 */
wireProperty('$entangle', (component) => (name, live = false) => {
    return generateEntangleFunction(component)(name, live)
})

/**
 * @template {Record<string, any>} Properties
 * @typedef {{$toggle: (name: keyof Properties, live?: boolean) => Promise<any>}} WireObject_$toggle
 */
wireProperty('$toggle', (component) => (name, live = true) => {
    return component.$wire.set(name, ! component.$wire.get(name), live)
})

/**
 * @typedef {{$watch: (path: string, callback: (value: any) => void) => () => void}} WireObject_$watch
 */
wireProperty('$watch', (component) => (path, callback) => {
    let getter = () => {
        return dataGet(component.reactive, path)
    }

    let unwatch = Alpine.watch(getter, callback)

    component.addCleanup(unwatch)

    return unwatch
})

/**
 * @typedef {{$effect: (callback: () => void) => any}} WireObject_$effect
 */
wireProperty('$effect', (component) => (callback) => {
    let effect = Alpine.effect(callback)

    component.addCleanup(effect)

    return effect
})

/**
 * @typedef {{$refresh: () => Promise<any>}} WireObject_$refresh
 */
wireProperty('$refresh', (component) => async () => {
    return fireAction(component, '$refresh')
})

/**
 * @typedef {{$commit: () => Promise<any>}} WireObject_$commit
 */
wireProperty('$commit', (component) => async () => {
    return fireAction(component, '$commit')
})

/**
 * @typedef {{$on: import('./types').OmitFirstParameter<typeof import('./events').listen>}} WireObject_$on
 */
wireProperty('$on', (component) => (...params) => listen(component, ...params))

/**
 * @typedef {{$hook: typeof import('./hooks').on}} WireObject_$hook
 */
wireProperty('$hook', (component) => (name, callback) => {
    let unhook = hook(name, ({component: hookComponent, ...params}) => {
        // Request level hooks don't have a component, so just run the callback
        if (hookComponent === undefined) return callback(params)

        // Run the callback if the component in the hook matches the $wire component
        if (hookComponent.id === component.id) return callback({component: hookComponent, ...params})
    })

    component.addCleanup(unhook)

    // Return the unhook function so it can be called manually if needed
    return unhook
})

/**
 * @typedef {{$dispatch: import('./types').OmitFirstParameter<typeof import('./events').dispatch>}} WireObject_$dispatch
 */
wireProperty('$dispatch', (component) => (...params) => dispatch(component, ...params))

/**
 * @typedef {{$dispatchSelf: import('./types').OmitFirstParameter<typeof import('./events').dispatchSelf>}} WireObject_$dispatchSelf
 */
wireProperty('$dispatchSelf', (component) => (...params) => dispatchSelf(component, ...params))

/**
 * @typedef {{$dispatchTo: import('./types').OmitFirstParameter<typeof import('./events').dispatchTo>}} WireObject_$dispatchTo
 */
wireProperty('$dispatchTo', () => (...params) => dispatchTo(...params))

/**
 * @typedef {{$dispatchEl: import('./types').OmitFirstParameter<typeof import('./events').dispatchEl>}} WireObject_$dispatchEl
 */
wireProperty('$dispatchEl', (component) => (...params) => dispatchEl(component, ...params))

/**
 * @typedef {{$dispatchRef: import('./types').OmitFirstParameter<typeof import('./events').dispatchRef>}} WireObject_$dispatchRef
 */
wireProperty('$dispatchRef', (component) => (...params) => dispatchRef(component, ...params))

/**
 * @typedef {{$upload: import('./types').OmitFirstParameter<typeof import('./features/supportFileUploads').upload>}} WireObject_$upload
 */
wireProperty('$upload', (component) => (...params) => upload(component, ...params))

/**
 * @typedef {{$uploadMultiple: import('./types').OmitFirstParameter<typeof import('./features/supportFileUploads').uploadMultiple>}} WireObject_$uploadMultiple
 */
wireProperty('$uploadMultiple', (component) => (...params) => uploadMultiple(component, ...params))

/**
 * @typedef {{$removeUpload: import('./types').OmitFirstParameter<typeof import('./features/supportFileUploads').removeUpload>}} WireObject_$removeUpload
 */
wireProperty('$removeUpload', (component) => (...params) => removeUpload(component, ...params))

/**
 * @typedef {{$cancelUpload: import('./types').OmitFirstParameter<typeof import('./features/supportFileUploads').cancelUpload>}} WireObject_$cancelUpload
 */
wireProperty('$cancelUpload', (component) => (...params) => cancelUpload(component, ...params))

let parentMemo = new WeakMap

/**
 * @typedef {{$parent: WireObject | undefined}} WireObject_$parent
 */
wireProperty('$parent', component => {
    if (parentMemo.has(component)) return parentMemo.get(component).$wire

    let parent = findComponentByEl(component.el.parentElement, false)

    if (! parent) return

    parentMemo.set(component, parent)

    return parent.$wire
})

let overriddenMethods = new WeakMap

export function overrideMethod(component, method, callback) {
    if (! overriddenMethods.has(component)) {
        overriddenMethods.set(component, {})
    }

    let obj = overriddenMethods.get(component)

    obj[method] = callback

    overriddenMethods.set(component, obj)
}

wireFallback((component) => (property) => (...params) => {
    // If this method is passed directly to a Vue or Alpine
    // event listener (@click="someMethod") without using
    // parens, strip out the automatically added event.
    if (params.length === 1 && params[0] instanceof Event) {
        params = []
    }

    if (overriddenMethods.has(component)) {
        let overrides = overriddenMethods.get(component)

        if (typeof overrides[property] === 'function') {
            return overrides[property](params)
        }
    }

    return fireAction(component, property, params)
})

/**
 * @template {Record<string, any>} [Properties=Record<string, any>]
 * @template {Record<string, (...params) => any>} [Methods=Record<string, (...params) => any>]
 * @typedef {WireObject___instance
 * & WireObject_$get<Properties>
 * & WireObject_$el
 * & WireObject_$id
 * & WireObject_$js
 * & WireObject_$set<Properties>
 * & WireObject_$refs
 * & WireObject_$dirty<Properties>
 * & WireObject_$intercept
 * & WireObject_$interceptAction
 * & WireObject_$interceptMessage
 * & WireObject_$interceptRequest
 * & WireObject_$errors<Properties>
 * & WireObject_$call<Methods>
 * & WireObject_$island<Properties, Methods>
 * & WireObject_$entangle<Properties>
 * & WireObject_$toggle<Properties>
 * & WireObject_$watch
 * & WireObject_$effect
 * & WireObject_$refresh
 * & WireObject_$commit
 * & WireObject_$on
 * & WireObject_$hook
 * & WireObject_$dispatch
 * & WireObject_$dispatchSelf
 * & WireObject_$dispatchTo
 * & WireObject_$dispatchEl
 * & WireObject_$dispatchRef
 * & WireObject_$upload
 * & WireObject_$uploadMultiple
 * & WireObject_$removeUpload
 * & WireObject_$cancelUpload
 * & WireObject_$parent
 * & Properties
 * & Methods} WireObject
 */
