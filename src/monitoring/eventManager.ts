import { MempoolMonitor } from './mempoolMonitor';
import { UpgradeFilter } from './filters/upgradeFilter';
import { ERC20Filter } from './filters/erc20Filter';
import { UpgradeHandler } from './handlers/upgradeHandler';
import { HackerActivityHandler } from './handlers/hackerActivityHandler';
import { BundleOpportunityHandler } from './handlers/bundleOpportunityHandler';
import { AlertLogger } from './alertLogger';
import { SafeProposalMonitor } from './safe/safeProposalMonitor';
import { ConfirmationTracker } from './safe/confirmationTracker';
import { GasController } from '../gasController';
import {
    UpgradeDetectedEvent,
    HackerActivityEvent,
    BundleOpportunityEvent,
    EmergencyResponseEvent
} from './types';
import {
    ProposalDetectedEvent,
    ConfirmationsReadyEvent
} from './safe/safeApiTypes';

export class ThreePhaseEventManager {
    private monitor: MempoolMonitor;
    private upgradeHandler: UpgradeHandler;
    private hackerActivityHandler: HackerActivityHandler;
    private bundleOpportunityHandler: BundleOpportunityHandler;
    
    // Three-Phase System Components
    private safeProposalMonitor: SafeProposalMonitor;
    private confirmationTracker: ConfirmationTracker;
    private gasController: GasController;
    
    // State tracking
    private currentPhase: 'standby' | 'proposal-detected' | 'confirmations-ready' | 'mempool-active' = 'standby';

    constructor(
        websocketUrl: string,
        compromisedAddress: string,
        erc20TokenAddress: string,
        proxyAddress: string,
        proxyAdminAddress: string,
        safeAddress: string,
        safeApiBaseUrl?: string
    ) {
        // Initialize mempool monitor
        this.monitor = new MempoolMonitor(websocketUrl);
        
        // Add filters for regular monitoring
        this.monitor.addFilter(new ERC20Filter(compromisedAddress, erc20TokenAddress));
        this.monitor.addFilter(new UpgradeFilter(proxyAddress, proxyAdminAddress));
        
        // Initialize handlers
        this.upgradeHandler = new UpgradeHandler();
        this.hackerActivityHandler = new HackerActivityHandler();
        this.bundleOpportunityHandler = new BundleOpportunityHandler();
        
        // Initialize three-phase system components
        this.safeProposalMonitor = new SafeProposalMonitor(
            safeAddress,
            proxyAdminAddress,
            safeApiBaseUrl
        );
        
        this.confirmationTracker = new ConfirmationTracker(
            safeAddress,
            safeApiBaseUrl
        );
        
        this.gasController = new GasController();
        
        // Setup event handling for all phases
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // PHASE 1: Safe Proposal Monitor Events
        this.safeProposalMonitor.on('proposal-detected', (event: ProposalDetectedEvent) => {
            AlertLogger.logInfo('📡 PHASE 1 → PHASE 2: Proposal detected');
            this.handleProposalDetected(event);
        });

        this.safeProposalMonitor.on('upgrade-detected', (event: UpgradeDetectedEvent) => {
            AlertLogger.logInfo('📡 PHASE 1 → BUNDLE2: Already executed upgrade detected');
            this.upgradeHandler.handleEvent(event);
        });

        // PHASE 2: Confirmation Tracker Events
        this.confirmationTracker.on('confirmations-ready', (event: ConfirmationsReadyEvent) => {
            AlertLogger.logInfo('📡 PHASE 2 → PHASE 3: Confirmations ready');
            this.handleConfirmationsReady(event);
        });

        this.confirmationTracker.on('upgrade-detected', (event: UpgradeDetectedEvent) => {
            AlertLogger.logInfo('📡 PHASE 2 → BUNDLE2: Executed upgrade detected');
            this.upgradeHandler.handleEvent(event);
        });

        // PHASE 3: Enhanced Mempool Monitor Events  
        this.monitor.on('upgrade-detected', (event: UpgradeDetectedEvent) => {
            AlertLogger.logInfo('📡 PHASE 3 → BUNDLE2: Target upgrade transaction detected');
            this.upgradeHandler.handleEvent(event);
        });

        this.monitor.on('hacker-erc20-activity', (event: HackerActivityEvent) => {
            AlertLogger.logInfo('📡 Event: hacker-erc20-activity received');
            this.hackerActivityHandler.handleEvent(event);
        });

        // Handler events → Bundle opportunity handler
        this.upgradeHandler.on('bundle-opportunity', (event: BundleOpportunityEvent) => {
            AlertLogger.logInfo('📡 Event: bundle-opportunity received from upgrade handler');
            this.bundleOpportunityHandler.handleEvent(event);
        });

        this.hackerActivityHandler.on('emergency-response', (event: EmergencyResponseEvent) => {
            AlertLogger.logInfo('📡 Event: emergency-response received from hacker handler');
            this.handleEmergencyResponse(event);
        });

        // Bundle preparation success events
        this.bundleOpportunityHandler.on('bundle2-prepared', (data: any) => {
            AlertLogger.logInfo('✅ Bundle2 preparation completed');
            // TODO: Connect to actual bundle submission logic
        });

        this.bundleOpportunityHandler.on('emergency-bundle-prepared', (data: any) => {
            AlertLogger.logInfo('🚨 Emergency bundle preparation completed');
            // TODO: Connect to actual emergency bundle submission logic
        });
    }

    private async handleProposalDetected(event: ProposalDetectedEvent): Promise<void> {
        this.currentPhase = 'proposal-detected';
        
        AlertLogger.logInfo('🎯 PHASE 1 COMPLETE: Upgrade proposal detected');
        AlertLogger.logInfo(`Safe Tx Hash: ${event.safeTxHash}`);
        AlertLogger.logInfo(`Confirmations: ${event.confirmations}/${event.required}`);
        AlertLogger.logInfo('📋 Starting PHASE 2: Confirmation tracking...');
        
        // Start tracking this proposal in Phase 2
        this.confirmationTracker.trackProposal(event.proposal);
        
        if (!this.confirmationTracker.isRunning) {
            this.confirmationTracker.start();
        }
    }

    private async handleConfirmationsReady(event: ConfirmationsReadyEvent): Promise<void> {
        this.currentPhase = 'confirmations-ready';
        
        AlertLogger.logInfo('🚀 PHASE 2 COMPLETE: Confirmations threshold reached!');
        AlertLogger.logInfo(`Safe Tx Hash: ${event.safeTxHash}`);
        AlertLogger.logInfo(`Confirmations: ${event.confirmations}/${event.required}`);
        AlertLogger.logInfo('⚡ Starting PHASE 3: Aggressive mempool monitoring...');
        
        // Activate gas controller aggressive mode
        this.gasController.setMode('aggressive');
        
        // Configure mempool monitor for targeted detection
        this.monitor.setTargetTransaction(event.expectedTransactionPattern);
        this.monitor.enableAggressiveMode();
        
        this.currentPhase = 'mempool-active';
        
        AlertLogger.logInfo('🔥 PHASE 3 ACTIVE: Ready to intercept upgrade transaction!');
    }

    private async handleEmergencyResponse(event: EmergencyResponseEvent): Promise<void> {
        AlertLogger.logInfo('🚨 EMERGENCY RESPONSE TRIGGERED');
        
        // Always use emergency gas pricing
        const emergencyGas = this.gasController.getEmergencyGas();
        
        switch (event.action) {
            case 'replace-with-higher-gas':
                AlertLogger.logInfo('Preparing higher gas replacement transaction...');
                AlertLogger.logInfo(`Emergency Gas: ${emergencyGas.maxFeePerGas} wei`);
                // TODO: Implement emergency replacement logic
                break;
            case 'emergency-bundle':
                AlertLogger.logInfo('Creating emergency recovery bundle...');
                AlertLogger.logInfo(`Emergency Gas: ${emergencyGas.maxFeePerGas} wei`);
                // TODO: Implement emergency bundle creation
                break;
        }
    }

    // Public API for external event listeners
    public on(eventType: string, handler: Function): void {
        this.monitor.on(eventType, handler);
    }

    public async start(): Promise<void> {
        AlertLogger.logInfo('🚀 Starting Three-Phase Fund Recovery System');
        AlertLogger.logInfo('=' .repeat(60));
        AlertLogger.logInfo('🔍 PHASE 1: Safe API Proposal Monitoring');
        AlertLogger.logInfo('📋 PHASE 2: Confirmation Tracking');
        AlertLogger.logInfo('⚡ PHASE 3: Aggressive Mempool Interception');
        AlertLogger.logInfo('=' .repeat(60));
        
        // Start Phase 1: Safe proposal monitoring
        this.safeProposalMonitor.start();
        
        // Start baseline mempool monitoring (for hacker activity detection)
        await this.monitor.start();
        
        // Phase 2 (ConfirmationTracker) will be started when proposals are detected
        // Phase 3 (Aggressive mode) will be activated when confirmations are ready
        
        AlertLogger.logInfo('✅ Three-Phase System initialized successfully');
        AlertLogger.logInfo('🎯 Currently in PHASE 1: Monitoring for upgrade proposals...');
        AlertLogger.logInfo('📡 All event handlers connected and ready');
    }

    public stop(): void {
        AlertLogger.logInfo('👋 Stopping Three-Phase System...');
        
        // Stop all phases
        this.safeProposalMonitor.stop();
        this.confirmationTracker.stop();
        this.monitor.stop();
        
        // Reset gas controller
        this.gasController.setMode('normal');
        this.monitor.disableAggressiveMode();
        this.monitor.clearTargetTransaction();
        
        this.currentPhase = 'standby';
        
        AlertLogger.logInfo('✅ All phases stopped');
    }

    public isMonitoring(): boolean {
        return this.monitor.isMonitoring();
    }

    // Configuration getters for external access
    public getMonitor(): MempoolMonitor {
        return this.monitor;
    }

    public getSafeProposalMonitor(): SafeProposalMonitor {
        return this.safeProposalMonitor;
    }

    public getConfirmationTracker(): ConfirmationTracker {
        return this.confirmationTracker;
    }

    public getGasController(): GasController {
        return this.gasController;
    }

    public getCurrentPhase(): string {
        return this.currentPhase;
    }

    public getSystemStatus(): {
        currentPhase: string;
        safeMonitorStatus: any;
        confirmationTrackerRunning: boolean;
        mempoolMonitorStatus: any;
        gasControllerStatus: any;
    } {
        return {
            currentPhase: this.currentPhase,
            safeMonitorStatus: this.safeProposalMonitor.getStatus(),
            confirmationTrackerRunning: this.confirmationTracker.isRunning,
            mempoolMonitorStatus: this.monitor.getEnhancedStatus(),
            gasControllerStatus: this.gasController.getStatus()
        };
    }
}