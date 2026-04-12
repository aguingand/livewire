import { componentsByName } from "@/store"
import { findRefEl } from "@/features/supportRefs"

/**
 * @param {import('../component').Component} component
 * @param {string} name
 * @param {any} params
 */
export function dispatch(component, name, params) {
    dispatchEvent(component.el, name, params)
}

/**
 * @param {string} name
 * @param {any} params
 */
export function dispatchGlobal(name, params) {
    dispatchEvent(window, name, params)
}

/**
 * @param {import('../component').Component} component
 * @param {string} name
 * @param {any} params
 */
export function dispatchSelf(component, name, params) {
    dispatchEvent(component.el, name, params, false)
}

/**
 * @param {import('../component').Component} component
 * @param {string} selector
 * @param {string} name
 * @param {any} params
 */
export function dispatchEl(component, selector, name, params) {
    let targets = component.el.querySelectorAll(selector)

    targets.forEach(target => {
        dispatchEvent(target, name, params, false)
    })
}

/**
 * @param {string} componentName
 * @param {string} name
 * @param {any} params
 */
export function dispatchTo(componentName, name, params) {
    let targets = componentsByName(componentName)

    targets.forEach(target => {
        dispatchEvent(target.el, name, params, false)
    })
}

/**
 * @param {import('../component').Component} component
 * @param {string} ref
 * @param {string} name
 * @param {any} params
 */
export function dispatchRef(component, ref, name, params) {
    let el = findRefEl(component, ref)

    dispatchEvent(el, name, params, false)
}

/**
 * @param {import('../component').Component} component
 * @param {string} name
 * @param {(params: any) => void} callback
 */
export function listen(component, name, callback) {
    component.el.addEventListener(name, e => {
        callback(e.detail)
    })
}

/**
 * @param {string} eventName
 * @param {(params: any) => void} callback
 */
export function on(eventName, callback) {
    let handler = (e) => {
        // Implemented for backwards compatibility...
        if (! e.__livewire) return

        callback(e.detail)
    }

    window.addEventListener(eventName, handler)

    return () => {
        window.removeEventListener(eventName, handler)
    }
}

function dispatchEvent(target, name, params, bubbles = true) {
    // We need to ensure the params are an array (or object), so we need to wrap them if they're not already...
    if (typeof params === 'string') {
        params = [params]
    }

    let e = new CustomEvent(name, { bubbles, detail: params })

    e.__livewire = { name, params, receivedBy: [] }

    target.dispatchEvent(e)
}
