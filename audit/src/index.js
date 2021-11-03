'use strict';
const logger = require('./logger').logger('MAIN');
const { getAppPods, deleteAppPods } = require('./k8s');
const { POD_MODE } = require('./k8s');
const AUDIT_PERIOD_SECS = 10;       // Audit frequency in seconds
const VERIFICATION_TIME_SECS = 1;   // The verification time in seconds
let verificationDone = false;

/**
 * Checks that App pods are in a consistent state, if not, the pods will be deleted after verification.
 */
async function auditpods() {
    logger.debug('App pods audit starting');

    // Get the running application pods
    const { status, pods } = await getAppPods('', 'Running');
    if (status !== 200) {
        logger.error(`Error listing pods: ${status}`);
        return;
    }
    logger.info('Returned App pods:', pods);
    if (pods.length < 2) {
        // Single or none App pod
        logger.debug('Number of App pods running:', pods.length);
        verificationDone = false;
        setTimeout(auditpods, AUDIT_PERIOD_SECS * 1000);
        return;
    }
    let podsToDelete = null;

    const standbyPods = pods.filter(pod => pod.mode === POD_MODE.STAND_BY);
    if (standbyPods.length === pods.length) {
        // All pods are in stand-by. Check redis and delete pods after verification time.
        logger.warn(`All pods are in stand - by.Verification done: ${verificationDone}`);
        podsToDelete = standbyPods;
    } else {
        // Make sure there is only one pod in active mode.
        const activePods = pods.filter(pod => pod.mode === POD_MODE.ACTIVE);
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
                auditpods();
            }, VERIFICATION_TIME_SECS * 1000);
            return;
        }

        // After verification the inconsistent state persisted.
        const result = await deleteAppPods(podsToDelete.map(pod => pod.name));
        if (result !== 200) {
            logger.error(`Error deleting pods: ${result}`);
        }
        // eslint-disable-next-line require-atomic-updates
        verificationDone = false;
    }
    setTimeout(auditpods, AUDIT_PERIOD_SECS * 1000);
}

// Start checking timer.
logger.info('Starting audit checking timer');
setTimeout(auditpods, AUDIT_PERIOD_SECS * 1000);

