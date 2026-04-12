// This errors object has the most common methods from \Illuminate\Support\MessageBag class on the backend...
import Alpine from 'alpinejs'

/**
 * @template {Record<string, any>} Properties
 * @param {import('../component').Component} component
 */
export function getErrorsObject(component) {
    let state = component.__errorsState ??= Alpine.reactive({
        clientErrors: null,
    })

    // Store lastSnapshot outside reactive state to avoid Proxy wrapping breaking identity comparison...
    component.__lastErrorsSnapshot ??= component.snapshot

    return {
        /**
         * @return {Record<keyof Properties, string[]>}
         */
        messages() {
            // If the snapshot changed (server responded), reset client overrides...
            if (component.__lastErrorsSnapshot !== component.snapshot) {
                state.clientErrors = null
                component.__lastErrorsSnapshot = component.snapshot
            }

            return state.clientErrors ?? component.snapshot.memo.errors
        },
        /**
         * @return {Array<keyof Properties>}
         */
        keys() {
            return Object.keys(this.messages())
        },
        /**
         * @param {Array<keyof Properties>} keys
         */
        has(...keys) {
            if (this.isEmpty()) return false

            if (keys.length === 0 || (keys.length === 1 && keys[0] == null)) return this.any()

            if (keys.length === 1 && Array.isArray(keys[0])) keys = keys[0]

            for (let key of keys) {
                if (this.first(key) === '') return false
            }

            return true
        },
        /**
         * @param {Array<keyof Properties>} keys
         */
        hasAny(keys) {
            if (this.isEmpty()) return false

            if (keys.length === 1 && Array.isArray(keys[0])) keys = keys[0]

            for (let key of keys) {
                if (this.has(key)) return true
            }

            return false
        },
        /**
         * @param {Array<keyof Properties>} keys
         */
        missing(...keys) {
            if (keys.length === 1 && Array.isArray(keys[0])) keys = keys[0]

            return ! this.hasAny(keys)
        },
        /**
         * @param {keyof Properties} key
         * @return {string}
         */
        first(key = null) {
            let messages = key === null ? this.all() : this.get(key)

            let firstMessage = messages.length > 0 ? messages[0] : ''

            return Array.isArray(firstMessage) ? firstMessage[0] : firstMessage
        },
        /**
         * @param {keyof Properties} key
         * @return {string[]}
         */
        get(key) {
            return this.messages()[key] || []
        },

        all() {
            return Object.values(this.messages()).flat()
        },

        isEmpty() {
            return ! this.any()
        },

        isNotEmpty() {
            return this.any()
        },

        any() {
            return Object.keys(this.messages()).length > 0
        },

        count() {
            return Object.values(this.messages()).reduce((total, array) => {
                return total + array.length;
            }, 0);
        },

        /**
         * @param {keyof Properties} field
         */
        clear(field = null) {
            if (field === null) {
                state.clientErrors = {}
            } else {
                let errors = { ...(state.clientErrors ?? component.snapshot.memo.errors) }
                delete errors[field]
                state.clientErrors = errors
            }
        },
    }
}
