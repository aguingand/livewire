import { WeakBag } from "@/utils"



/**
 * @typedef {{
 * message: import('./message').default,
 * cancel: () => void,
 * onSend: (callback: MessageInterceptor['onSend']) => void,
 * onCancel: (callback: MessageInterceptor['onCancel']) => void,
 * onFailure: (callback: MessageInterceptor['onFailure']) => void,
 * onError: (callback: MessageInterceptor['onError']) => void,
 * onStream: (callback: MessageInterceptor['onStream']) => void,
 * onSuccess: (callback: MessageInterceptor['onSuccess']) => void,
 * onSkipped: (callback: MessageInterceptor['onSkipped']) => void,
 * onFinish: (callback: MessageInterceptor['onFinish']) => void,
 * }} MessageInterceptorCallbackParams
 */
export class MessageInterceptor {
    /** @type {(params: { payload: { snapshot: string, updates: Record<string, any>, calls: Record<string, any>[] } }) => void} */
    onSend = () => {}
    /** @type {() => void} */
    onCancel = () => {}
    /** @type {(params: { error: Error }) => void} */
    onFailure = () => {}
    /** @type {(params: { response: Response, body: string, preventDefault: () => void }) => void} */
    onError = () => {}
    /** @type {(params: { json: any }) => void} */
    onStream = () => {}
    /** @type {(params: {
     * payload: { effects: Record<string, any>, snapshot: Record<string, any> },
     * onSync: (callback: () => void) => void,
     * onEffect: (callback: () => void) => void,
     * onMorph: (callback: () => void) => void,
     * onRender: (callback: () => void) => void
     * }) => void} */
    onSuccess = () => {}
    /** @type {() => void} */
    onSkipped = () => {}
    /** @type {() => void} */
    onFinish = () => {}
    /** @type {() => void} */
    onSync = () => {}
    /** @type {() => void} */
    onEffect = () => {}
    /** @type {() => Promise<void>} */
    onMorph = async () => {}
    /** @type {() => void} */
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
 * onSend: (callback: RequestInterceptor['onSend']) => void,
 * onCancel: (callback: RequestInterceptor['onCancel']) => void,
 * onFailure: (callback: RequestInterceptor['onFailure']) => void,
 * onResponse: (callback: RequestInterceptor['onResponse']) => void,
 * onParsed: (callback: RequestInterceptor['onParsed']) => void,
 * onError: (callback: RequestInterceptor['onError']) => void,
 * onStream: (callback: RequestInterceptor['onStream']) => void,
 * onRedirect: (callback: RequestInterceptor['onRedirect']) => void,
 * onDump: (callback: RequestInterceptor['onDump']) => void,
 * onSuccess: (callback: RequestInterceptor['onSuccess']) => void,
 * onFinish: (callback: RequestInterceptor['onFinish']) => void,
 * }} RequestInterceptorCallbackParams
 */
export class RequestInterceptor {
    /** @type {(params: { responsePromise: Promise<Response> }) => void} */
    onSend = () => {}
    /** @type {() => void} */
    onCancel = () => {}
    /** @type {(params: { error: Error }) => void} */
    onFailure = () => {}
    /** @type {(params: { response: Response }) => void} */
    onResponse = () => {}
    /** @type {(params: { response: Response, body: string }) => void} */
    onParsed = () => {}
    /** @type {(params: { response: Response, body: string, preventDefault: () => void }) => void} */
    onError = () => {}
    /** @type {(params: { response: Response }) => void} */
    onStream = () => {}
    /** @type {(params: { url: string, preventDefault: () => void }) => void} */
    onRedirect = () => {}
    /** @type {(params: { html: string, preventDefault: () => void }) => void} */
    onDump = () => {}
    /** @type {(params: { response: Response, body: string, json: any }) => void} */
    onSuccess = () => {}
    /** @type {() => void} */
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
