'use strict';
const logger = require('./logger').logger('MAIN');
const { Client } = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const backend = new Request(Request.config.getInCluster());
const client = new Client({ backend, version: '1.13' });
const NAMESPACE = process.env.K8S_NAMESPACE || 'default';
const { POD_MODE } = require('./k8s');
const AUDIT_PERIOD_SECS = 10;       // Audit frequency in seconds
const VERIFICATION_TIME_SECS = 1;   // The verification time in seconds
let verificationDone = false;

/**
 * Deletes the given pods.
 *
 * @param {Array<string>} pods - The names of the pods to be deleted.
 */
async function deleteAppPods(pods) {
    pods.forEach(async podName => {
        logger.debug(`Deleting pod ${podName}`);
        try {
            const result = await client.api.v1.namespaces(NAMESPACE).pods(podName)
                .delete();
            logger.debug('Delete pod result: ', result);
        } catch (error) {
            logger.error(`Error deleting pod ${podName}. Error: ${error.text || error.message}`);
        }
    });
}

/**
 * Gets all the App pods matching the given mode label value and phase.
 *
 * @param {string} [mode] - The value of the mode label. If none is provided all App pods are retrieved.
 * @param {string} [phase] - The status phase of the pod, i.e Running, Terminating, etc.
 * @returns {Promise<Array<object>>} The name of the pods matching the mode label value, and such mode vale.
 */
async function getAppPods(mode, phase) {
    try {
        let labelSelector = 'app=app';
        if (mode) {
            labelSelector += `,mode=${mode}`;
        }
        const fieldSelector = phase ? `status.phase=${phase}` : '';

        const result = await client.api.v1.namespaces(NAMESPACE).pods.get({ qs: { labelSelector, fieldSelector } });
        logger.info('List pods result: ', JSON.stringify(result.body));
        if (result.statusCode !== 200) {
            logger.error(`Unable to get pods data. Error: ${result.statusCode}`);
            return [];
        }
        result.body.items.forEach(pod => {
            logger.info(`Mode: ${pod.metadata.labels.mode}, statuses: ${JSON.stringify(pod.status.containerStatuses)}`);
        });
        return result.body.items.map(pod => ({
            name: pod.metadata.name,
            mode: pod.metadata.labels.mode,
            running: !!pod.status.containerStatuses[0].state.running?.startedAt
        })).filter(pod => pod.running);
    } catch (error) {
        logger.error(`Error listing App pods.Error: ${error.text || error.message}`);
        return [];
    }
}

/**
 * Checks that App pods are in a consistent state, if not, the pods will be deleted after verification.
 */
async function auditAppPods() {
    logger.debug('App pods audit starting');

    // Get the running application pods
    const appPods = await getAppPods('', 'Running');
    logger.info('Returned App pods:', appPods);
    if (appPods.length < 2) {
        // Single or none App pod
        logger.debug('Number of App pods running:', appPods.length);
        verificationDone = false;
        setTimeout(auditAppPods, AUDIT_PERIOD_SECS * 1000);
        return;
    }
    let podsToDelete = null;

    const standbyPods = appPods.filter(pod => pod.mode === POD_MODE.STAND_BY);
    if (standbyPods.length === appPods.length) {
        // All pods are in stand-by. Check redis and delete pods after verification time.
        logger.warn(`All pods are in stand - by.Verification done: ${verificationDone}`);
        podsToDelete = standbyPods;
    } else {
        // Make sure there is only one pod in active mode.
        const activePods = appPods.filter(pod => pod.mode === POD_MODE.ACTIVE);
        if (activePods.length > 1) {
            // There are more than one active pod. Delete all active pods after verification time.
            logger.warn(`There are ${activePods.length} active pods.Verification done: ${verificationDone}`);
            podsToDelete = activePods;
        }
    }

    if (podsToDelete) {
        // There is an inconsistent state and pods should be deleted.
        if (!verificationDone) {
            // Verification has not been done. Start verification timer.
            logger.info(`Need to verify inconsistency in ${VERIFICATION_TIME_SECS} seconds`);
            setTimeout(() => {
                logger.info('Start verification...');
                verificationDone = true;
                auditAppPods();
            }, VERIFICATION_TIME_SECS * 1000);
            return;
        }

        // After verification the inconsistent state persisted.
        deleteAppPods(podsToDelete.map(pod => pod.name));
        verificationDone = false;
    }
    setTimeout(auditAppPods, AUDIT_PERIOD_SECS * 1000);
}

// Start checking timer.
logger.info('Starting audit checking timer');
setTimeout(auditAppPods, AUDIT_PERIOD_SECS * 1000);

