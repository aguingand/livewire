import { WeakBag } from "@/utils"

/**
 * @typedef {{
 * action: import('./action').default,
 * onSend: (callback: (params: { call: { method: string, params: Record<string, any>, metadata: Record<string, any> } }) => void) => void,
 * onCancel: (callback: () => void) => void,
 * onSuccess: (callback: (result: any) => void) => void,
 * onError: (callback: (params: { response: Response, body: string, preventDefault: () => void }) => void) => void,
 * onFailure: (callback: (params: { error: Error }) => void) => void,
 * onFinish: (callback: () => void) => void,
 * }} ActionInterceptorCallbackParams
 */

/**
 * @typedef {{
 * message: import('./message').default,
 * cancel: () => void,
 * onSend: (callback: Function) => void,
 * onCancel: (callback: Function) => void,
 * onFailure: (callback: Function) => void,
 * onError: (callback: Function) => void,
 * onStream: (callback: Function) => void,
 * onSuccess: (callback: Function) => void,
 * onSkipped: (callback: Function) => void,
 * onFinish: (callback: Function) => void,
 * }} MessageInterceptorCallbackParams
 */
export class MessageInterceptor {
    onSend = () => {}
    onCancel = () => {}
    onFailure = () => {}
    onError = () => {}
    onStream = () => {}
    onSuccess = () => {}
    onSkipped = () => {}
    onFinish = () => {}
    onSync = () => {}
    onEffect = () => {}
    onMorph = async () => {}
    onRender = () => {}

    /**
     * @param {import('./message').default} message
     * @param {(params: MessageInterceptorCallbackParams) => void} callback
     */
    constructor(message, callback) {
        this.message = message
        this.callback = callback

        this.callback({
            message: this.message,
            cancel: () => {
                // If we're not yet attached to the message's interceptors,
                // call our own onCancel since message.invokeOnCancel() won't reach us
                let attachedToMessage = this.message.getInterceptors().includes(this)

                if (!attachedToMessage) {
                    this.onCancel()
                }

                this.message.cancel()
            },
            onSend: (callback) => this.onSend = callback,
            onCancel: (callback) => this.onCancel = callback,
            onFailure: (callback) => this.onFailure = callback,
            onError: (callback) => this.onError = callback,
            onStream: (callback) => this.onStream = callback,
            onSuccess: (callback) => this.onSuccess = callback,
            onSkipped: (callback) => this.onSkipped = callback,
            onFinish: (callback) => this.onFinish = callback,
        })
    }

    init() {
        // Reserved for future use
    }
}

/**
 * @typedef {{
 * request: import('./request').MessageRequest,
 * onSend: (callback: Function) => void,
 * onCancel: (callback: Function) => void,
 * onFailure: (callback: Function) => void,
 * onResponse: (callback: Function) => void,
 * onParsed: (callback: Function) => void,
 * onError: (callback: Function) => void,
 * onStream: (callback: Function) => void,
 * onRedirect: (callback: Function) => void,
 * onDump: (callback: Function) => void,
 * onSuccess: (callback: Function) => void,
 * onFinish: (callback: Function) => void,
 * }} RequestInterceptorCallbackParams
 */
export class RequestInterceptor {
    onSend = () => {}
    onCancel = () => {}
    onFailure = () => {}
    onResponse = () => {}
    onParsed = () => {}
    onError = () => {}
    onStream = () => {}
    onRedirect = () => {}
    onDump = () => {}
    onSuccess = () => {}
    onFinish = () => {}

    /**
     * @param {import('./request').MessageRequest} request
     * @param {(params: RequestInterceptorCallbackParams) => void} callback
     */
    constructor(request, callback) {
        this.request = request
        this.callback = callback

        this.callback({
            request: this.request,
            onSend: (callback) => this.onSend = callback,
            onCancel: (callback) => this.onCancel = callback,
            onFailure: (callback) => this.onFailure = callback,
            onResponse: (callback) => this.onResponse = callback,
            onParsed: (callback) => this.onParsed = callback,
            onError: (callback) => this.onError = callback,
            onStream: (callback) => this.onStream = callback,
            onRedirect: (callback) => this.onRedirect = callback,
            onDump: (callback) => this.onDump = callback,
            onSuccess: (callback) => this.onSuccess = callback,
            onFinish: (callback) => this.onFinish = callback,
        })
    }

    init() {
        // Reserved for future use
    }
}

export class InterceptorRegistry {
    messageInterceptorCallbacks = []
    messageInterceptorCallbacksByComponent = new WeakBag
    requestInterceptorCallbacks = []

    addInterceptor(component, callback) {
        this.messageInterceptorCallbacksByComponent.add(component, callback)

        return () => {
            this.messageInterceptorCallbacksByComponent.delete(component, callback)
        }
    }

    addMessageInterceptor(callback) {
        this.messageInterceptorCallbacks.push(callback)

        return () => {
            this.messageInterceptorCallbacks.splice(this.messageInterceptorCallbacks.indexOf(callback), 1)
        }
    }

    addRequestInterceptor(callback) {
        this.requestInterceptorCallbacks.push(callback)

        return () => {
            this.requestInterceptorCallbacks.splice(this.requestInterceptorCallbacks.indexOf(callback), 1)
        }
    }

    getMessageInterceptors(message) {
        let callbacks = [
            ...this.messageInterceptorCallbacksByComponent.get(message.component),
            ...this.messageInterceptorCallbacks,
        ]

        return callbacks.map(callback => {
            return new MessageInterceptor(message, callback)
        })
    }

    getRequestInterceptors(request) {
        return this.requestInterceptorCallbacks.map(callback => {
            return new RequestInterceptor(request, callback)
        })
    }
}
