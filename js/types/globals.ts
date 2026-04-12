

declare global {
    const $wire: import('laravel-livewire').LivewireComponentProperties & import('../$wire').WireObject;
    const Alpine: typeof import('alpinejs').Alpine;
    const Livewire: typeof import('../index').Livewire;
}

export {}
