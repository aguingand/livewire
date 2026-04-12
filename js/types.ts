
export type OmitFirstParameter<T extends (...args: any[]) => any> =
    T extends (first: any, ...rest: infer Rest) => infer ReturnType
        ? (...args: Rest) => ReturnType
        : never;

declare global {
    const $wire: import('./$wire').WireObject;
    // @ts-ignore
    const Alpine: import('alpinejs').Alpine;
    const Livewire: typeof import('./index').Livewire;
}

export {}
