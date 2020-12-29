import * as _ from 'lodash-es';
import type { Unsubscribable, PartialObserver, NextObserver } from 'rxjs';

export type Source<T> = {
	/* RxJS interface.
	 */
	subscribe(observer: PartialObserver<T>): Unsubscribable;

	/* Svelte interface.
	 */
	subscribe(next: (val: any) => void): Unsubscribable;
};

export type Sink<T> = {
	/* Svelte interface.
	 */
	set(value: T): void;
};

export function subscribe<T>(
	store: Source<T>,
	subscriber: PartialObserver<T> | ((val: any) => void)
): Unsubscribable {
	return store.subscribe(subscriber as any);
}

export function set<T>(store: Sink<T>, value: T) {
	store.set(value);
}

export function get<T>(store: Source<T>): T {
	if (store instanceof Store) {
		return store.get();
	}

	let value: any;
	store.subscribe((val) => (value = val));
	return value;
}

export function update<T>(store: Source<T> & Sink<T>, fn: (value: T) => T) {
	if (store instanceof Store) {
		return store.update(fn);
	}

	return store.set(fn(get(store)));
}

const computations: Array<any> = [];
function computed<T>(fn: () => T) {
	let self = store(null);
	let token: (() => void)[] = [run];

	function run() {
		if (computations.includes(token)) {
			throw Error('Circular computation');
		}

		computations.push(token);

		let result: T;
		try {
			result = fn();
		} catch (e) {
			computations.pop();
			throw e;
		}

		computations.pop();
		self.set(result);
	}

	run();
	return self;
}

export function store<T>(value: T): Store<T> {
	return _.isFunction(value)
		? computed((value as unknown) as () => T)
		: new Store<T>(value);
}

export class Store<T> implements Source<T>, Sink<T> {
	private observers = new Set<PartialObserver<T>>();

	constructor(private value: T) {}

	subscribe(next: (val: any) => void): Unsubscribable;
	subscribe(observer: PartialObserver<T>): Unsubscribable;
	subscribe(
		subscriber: PartialObserver<T> | ((val: any) => void)
	): Unsubscribable {
		const observer: PartialObserver<T> = _.isFunction(subscriber)
			? <NextObserver<T>>{ next: subscriber }
			: (subscriber as PartialObserver<T>);

		// FIXME(meh): This won't work when passing a function, it will be subscribed twice
		this.observers.add(observer);

		return {
			unsubscribe() {
				_.remove(this.observers, (o: any) => o === observer);
			},
		};
	}

	set(val: any) {
		if (val === this.value) {
			return;
		}

		this.value = val;

		for (const observer of this.observers) {
			observer.next?.(val);
		}
	}

	get() {
		const running = _.last(computations);

		if (running) {
			this.subscribe(_.first(running));
		}

		return this.value;
	}

	refresh() {
		for (const observer of this.observers) {
			observer.next?.(this.value);
		}
	}

	update(fn: (value: T) => T) {
		this.set(fn(this.value));
	}
}
