/*!
 * Piwik - free/libre analytics platform
 *
 * Screenshot integration tests.
 *
 * @link http://piwik.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

describe("TwoFactorAuth", function () {
    this.timeout(0);

    this.fixture = "Piwik\\Plugins\\TwoFactorAuth\\tests\\Fixtures\\TwoFactorFixture";

    var generalParams = 'idSite=1&period=day&date=2010-01-03',
        userSettings = '?module=UsersManager&action=userSettings&' + generalParams,
        logoutUrl = '?module=Login&action=logout&period=day&date=yesterday';


    async function selectModalButton(button)
    {
        await page.click('.modal.open .modal-footer a:contains('+button+')');
    }

    async function loginUser(username, doAuth)
    {
        // make sure to log out previous session
        await page.goto(logoutUrl);

        if (typeof doAuth === 'undefined') {
            doAuth = true;
        }
        var logMeUrl = '?module=Login&action=logme&login=' + username + '&password=240161a241087c28d92d8d7ff3b6186b';
        if (doAuth) {
            logMeUrl += '&authCode=123456'; // we make sure in test config this code always works
        }
        await page.waitFor(1000);
        await page.goto(logMeUrl);
    }

    function requireTwoFa() {
        testEnvironment.requireTwoFa = 1;
        testEnvironment.save();
    }

    function fakeCorrectAuthCode() {
        testEnvironment.fakeCorrectAuthCode = 1;
        testEnvironment.save();
    }

    before(function () {
        testEnvironment.pluginsToLoad = ['TwoFactorAuth'];
        testEnvironment.queryParamOverride = { date: '2018-03-04' };
        testEnvironment.save();
    });

    beforeEach(function () {
        testEnvironment.testUseMockAuth = 0;
        testEnvironment.restoreRecoveryCodes = 1;
        testEnvironment.save();
    });

    afterEach(function () {
        delete testEnvironment.requireTwoFa;
        delete testEnvironment.restoreRecoveryCodes;
        delete testEnvironment.fakeCorrectAuthCode;
        testEnvironment.testUseMockAuth = 1;
        testEnvironment.save();
    });

    async function confirmPassword()
    {
        await page.evaluate(function(){
            $('.confirmPasswordForm #login_form_password').val('123abcDk3_l3');
            $('.confirmPasswordForm #login_form_submit').click();
        });
        await page.waitFor(750);
    }

    it('a user with 2fa can open the widgetized view by token without needing to verify', async function () {
        await page.goto('?module=Widgetize&action=iframe&moduleToWidgetize=Actions&actionToWidgetize=getPageUrls&date=2018-03-04&token_auth=c4ca4238a0b923820dcc509a6f75849b&' + generalParams);
        expect(await page.screenshotSelector('.widget')).to.matchImage('widgetized_no_verify');
    });

    it('when logging in through logme and not providing auth code it should show auth code screen', async function () {
        await loginUser('with2FA', false);
        expect(await page.screenshotSelector('.loginSection')).to.matchImage('logme_not_verified');
    });

    it('when logging in and providing wrong code an error is shown', async function () {
        await page.type('.loginTwoFaForm #login_form_authcode', '555555');
        await page.evaluate(function(){
            $('.loginTwoFaForm #login_form_submit').click();
        });
        await page.waitForNetworkIdle();
        expect(await page.screenshotSelector('.loginSection')).to.matchImage('logme_not_verified_wrong_code');
    });

    it('when logging in through logme and verifying screen it works to access ui', async function () {
        await page.type('.loginTwoFaForm #login_form_authcode', '123456');
        await page.evaluate(function(){
            $('.loginTwoFaForm #login_form_submit').click();
        });
        await page.waitFor(1500);
        expect(await page.screenshotSelector('#content')).to.matchImage('logme_verified');
    });

    it('should show user settings when two-fa enabled', async function () {
        await loginUser('with2FA');
        await page.goto(userSettings);
        expect(await page.screenshotSelector('.userSettings2FA')).to.matchImage('usersettings_twofa_enabled');
    });

    it('should be possible to show recovery codes step1 authentication', async function () {
        await page.click('.showRecoveryCodesLink');
        await page.waitForNetworkIdle();
        expect(await page.screenshotSelector('.loginSection')).to.matchImage('show_recovery_codes_step1');
    });

    it('should be possible to show recovery codes step2 done', async function () {
        await confirmPassword();
        await page.waitForNetworkIdle();
        expect(await page.screenshotSelector('#content')).to.matchImage('show_recovery_codes_step2');
    });

    it('should show user settings when two-fa enabled', async function () {
        requireTwoFa();
        await page.goto(userSettings);
        expect(await page.screenshotSelector('.userSettings2FA')).to.matchImage('usersettings_twofa_enabled_required');
    });

    it('should be possible to disable two factor', async function () {
        await loginUser('with2FADisable');
        await page.goto(userSettings);
        await page.click('.disable2FaLink');
        expect(await page.screenshotSelector('.modal.open')).to.matchImage('usersettings_twofa_disable_step1');
    });

    it('should be possible to disable two factor step 2 confirmed', async function () {
        await selectModalButton('Yes');
        expect(await page.screenshotSelector('.loginSection')).to.matchImage('usersettings_twofa_disable_step2');
    });

    it('should be possible to disable two factor step 3 verified', async function () {
        await confirmPassword();
        expect(await page.screenshotSelector('.userSettings2FA')).to.matchImage('usersettings_twofa_disable_step3');
    });

    it('should show setup screen - step 1', async function () {
        await loginUser('without2FA');
        await page.goto(userSettings);
        await page.click('.enable2FaLink');
        await confirmPassword();
        expect(await page.screenshotSelector('#content')).to.matchImage('twofa_setup_step1');
    });

    it('should move to second step in setup - step 2', async function () {
        console.log('start');
        await page.evaluate(function(){
            $('.setupTwoFactorAuthentication .backupRecoveryCode:first').click();
        });
        console.log(0);
        await page.waitForNetworkIdle();
        console.log(1);
        await page.click('.setupTwoFactorAuthentication .goToStep2');
        console.log(2);
        await page.waitForNetworkIdle();
        console.log(3);
        await page.evaluate(function () {
            $('#qrcode').hide();
        });
        console.log(4);
        expect(await page.screenshotSelector('#content')).to.matchImage('twofa_setup_step2');
    });

    it('should move to third step in setup - step 3', async function () {
        await page.click('.setupTwoFactorAuthentication .goToStep3');
        await page.waitForNetworkIdle();
        expect(await page.screenshotSelector('#content')).to.matchImage('twofa_setup_step3');
    });

    it('should move to third step in setup - step 4 confirm', async function () {
        fakeCorrectAuthCode();
        await page.type('.setupConfirmAuthCodeForm input[type=text]', '123458');
        await page.evaluate(function () {
            $('.setupConfirmAuthCodeForm input[type=text]').change();
        });
        await page.evaluate(function () {
            $('.setupConfirmAuthCodeForm .confirmAuthCode').click();
        });
        expect(await page.screenshotSelector('#content')).to.matchImage('twofa_setup_step4');
    });

    it('should force user to setup 2fa when not set up yet but enforced', async function () {
        requireTwoFa();
        await loginUser('no2FA', false);
        expect(await page.screenshotSelector('.loginSection,#content,#notificationContainer')).to.matchImage('twofa_forced_step1');
    });

    it('should force user to setup 2fa when not set up yet but enforced step 2', async function () {
        await page.click('.setupTwoFactorAuthentication .backupRecoveryCode:first');
        await page.click('.setupTwoFactorAuthentication .goToStep2');
        expect(await page.screenshotSelector('.loginSection,#content,#notificationContainer')).to.matchImage('twofa_forced_step2');
    });

    it('should force user to setup 2fa when not set up yet but enforced step 3', async function () {
        await page.click('.setupTwoFactorAuthentication .goToStep3');
        expect(await page.screenshotSelector('.loginSection,#content,#notificationContainer')).to.matchImage('twofa_forced_step3');
    });

    it('should force user to setup 2fa when not set up yet but enforced confirm code', async function () {
        requireTwoFa();
        fakeCorrectAuthCode();
        await page.type('.setupConfirmAuthCodeForm input[type=text]', '123458');
        await page.evaluate(function () {
            $('.setupConfirmAuthCodeForm input[type=text]').change();
        });
        await page.evaluate(function () {
            $('.setupConfirmAuthCodeForm .confirmAuthCode').click();
        });
        expect(await page.screenshotSelector('.loginSection,#content,#notificationContainer')).to.matchImage('twofa_forced_step4');
    });

});