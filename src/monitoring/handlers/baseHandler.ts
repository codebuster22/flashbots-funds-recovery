import { EventEmitter } from 'events';
import { MonitoringEvent } from '../types';

export abstract class BaseEventHandler extends EventEmitter {
    protected handlerName: string;

    constructor(handlerName: string) {
        super();
        this.handlerName = handlerName;
    }

    abstract handleEvent(event: MonitoringEvent): Promise<void>;
    
    getHandlerName(): string {
        return this.handlerName;
    }

    protected emitEvent(eventType: string, data: any): void {
        this.emit(eventType, data);
    }
}