/* Configuration JavaScript */

// Add global configuration object for frontend to reference backend API
const config = {
    apiUrl: 'https://your-python-backend.herokuapp.com/api',
    local: false,
    debug: false,
    theme: 'light'
};

$(document).ready(function() {
    // Toggle password visibility
    $('.toggle-password').click(function() {
        const targetId = $(this).data('target');
        const passwordInput = $('#' + targetId);
        const icon = $(this).find('i');

        if (passwordInput.attr('type') === 'password') {
            passwordInput.attr('type', 'text');
            icon.removeClass('bi-eye').addClass('bi-eye-slash');
        } else {
            passwordInput.attr('type', 'password');
            icon.removeClass('bi-eye-slash').addClass('bi-eye');
        }
    });

    // Update SDO API URL when SDO URL changes
    $('#sdo-url').on('input', function() {
        updateSdoApiUrl($(this).val());
    });

    // Function to update SDO API URL based on SDO URL
    function updateSdoApiUrl(sdoUrl) {
        if (sdoUrl) {
            // Clean and format URL
            const cleanUrl = sdoUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
            const apiUrl = 'https://' + cleanUrl + '/admin/api';
            $('#sdo-api-url').val(apiUrl);
        } else {
            $('#sdo-api-url').val('');
        }
    }

    // Test SDO Connection
    $('#test-sdo-connection').click(function() {
        const url = $('#sdo-url').val().trim();
        const email = $('#sdo-email').val().trim();
        const password = $('#sdo-password').val();

        if (!url || !email || !password) {
            $('#sdo-connection-result').html('<div class="alert alert-warning">Please fill in all SDO connection fields</div>');
            return;
        }

        // Show loading
        $('#sdo-connection-result').html('<div class="d-flex align-items-center"><div class="spinner-border spinner-border-sm me-2" role="status"></div> Testing connection...</div>');

        // Check if we're in Netlify environment
        if (config.local === false) {
            // We're in Netlify, can't directly test connection
            $('#sdo-connection-result').html('<div class="alert alert-info"><i class="bi bi-info-circle-fill me-2"></i> Connection testing is only available when connected to the backend.</div>');
            return;
        }

        // Make AJAX request to test connection
        $.ajax({
            url: '/test-sdo-connection',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                url: url,
                email: email,
                password: password
            }),
            success: function(response) {
                $('#sdo-connection-result').html('<div class="alert alert-success"><i class="bi bi-check-circle-fill me-2"></i> Connection successful!</div>');
            },
            error: function(xhr) {
                let errorMsg = 'Connection failed';
                try {
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.error) errorMsg = resp.error;
                } catch (e) {}

                $('#sdo-connection-result').html('<div class="alert alert-danger"><i class="bi bi-x-circle-fill me-2"></i> ' + errorMsg + '</div>');
            }
        });
    });

    // Test Au10tix Connection
    $('#test-au10tix-connection').click(function() {
        const token = $('#au10tix-token').val().trim();
        const baseUrl = $('#au10tix-base-url').val().trim() || 'https://eus-api.au10tixservicesstaging.com';

        if (!token) {
            $('#au10tix-connection-result').html('<div class="alert alert-warning">Please enter the Au10tix API token</div>');
            return;
        }

        // Show loading
        $('#au10tix-connection-result').html('<div class="d-flex align-items-center"><div class="spinner-border spinner-border-sm me-2" role="status"></div> Testing connection...</div>');

        // Check if we're in Netlify environment
        if (config.local === false) {
            // We're in Netlify, can't directly test connection
            $('#au10tix-connection-result').html('<div class="alert alert-info"><i class="bi bi-info-circle-fill me-2"></i> Connection testing is only available when connected to the backend.</div>');
            return;
        }

        // Make AJAX request to test connection
        $.ajax({
            url: '/test-au10tix-connection',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                token: token,
                base_url: baseUrl
            }),
            success: function(response) {
                $('#au10tix-connection-result').html('<div class="alert alert-success"><i class="bi bi-check-circle-fill me-2"></i> Connection successful!</div>');
            },
            error: function(xhr) {
                let errorMsg = 'Connection failed';
                try {
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.error) errorMsg = resp.error;
                } catch (e) {}

                $('#au10tix-connection-result').html('<div class="alert alert-danger"><i class="bi bi-x-circle-fill me-2"></i> ' + errorMsg + '</div>');
            }
        });
    });

    // Modified function to load configuration values for the current tab
    function loadConfigValues() {
        // Get active tab ID
        const activeTab = $('button.nav-link.active').attr('data-bs-target').replace('#', '');

        // Show loading indicator
        $('#' + activeTab + '-loading').removeClass('d-none');

        // Check if we're in Netlify environment
        if (config.local === false) {
            // We're in Netlify, load from localStorage
            loadConfigFromLocalStorage(activeTab);
            return;
        }

        // Make AJAX request to get configuration
        $.ajax({
            url: '/get-config',
            method: 'GET',
            data: { section: activeTab },
            success: function(response) {
                // Remove loading indicator
                $('#' + activeTab + '-loading').addClass('d-none');

                if (response.success) {
                    // Populate form fields with configuration values
                    const config = response.config || {};

                    // Save to localStorage for offline use
                    localStorage.setItem('portal_config_' + activeTab, JSON.stringify(config));

                    populateConfigForm(activeTab, config);

                    console.log('Configuration loaded successfully for section: ' + activeTab);
                } else {
                    showNotification('Failed to load configuration: ' + (response.error || 'Unknown error'), 'danger');
                }
            },
            error: function(xhr) {
                // Remove loading indicator
                $('#' + activeTab + '-loading').addClass('d-none');

                // Try to load from localStorage if API fails
                loadConfigFromLocalStorage(activeTab);
            }
        });
    }

    // New function to load config from localStorage
    function loadConfigFromLocalStorage(section) {
        const storedConfig = localStorage.getItem('portal_config_' + section);
        if (storedConfig) {
            try {
                const config = JSON.parse(storedConfig);
                populateConfigForm(section, config);
                $('#' + section + '-loading').addClass('d-none');
                console.log('Configuration loaded from localStorage for section: ' + section);
            } catch (e) {
                $('#' + section + '-loading').addClass('d-none');
                showNotification('Failed to load saved configuration', 'warning');
            }
        } else {
            $('#' + section + '-loading').addClass('d-none');
            console.log('No saved configuration found for section: ' + section);
        }
    }

    // New function to populate form with config values
    function populateConfigForm(section, config) {
        // Process each input by type
        $('#' + section + ' input[type="text"], ' +
          '#' + section + ' input[type="number"], ' +
          '#' + section + ' input[type="email"], ' +
          '#' + section + ' input[type="password"], ' +
          '#' + section + ' textarea, ' +
          '#' + section + ' select').each(function() {
            const name = $(this).attr('name');
            if (name && config[name] !== undefined) {
                $(this).val(config[name]);
            }
        });

        // Handle checkboxes separately
        $('#' + section + ' input[type="checkbox"]').each(function() {
            const name = $(this).attr('name');
            if (name && config[name] !== undefined) {
                $(this).prop('checked', config[name]);
            }
        });

        // If this is the auth tab, update the API URL based on the SDO URL
        if (section === 'auth' && config.sdo_url) {
            updateSdoApiUrl(config.sdo_url);
        }

        // Apply theme settings if theme value is found
        if (section === 'general' && config.theme) {
            applyThemeSettings();
        }
    }

    // Function to show notification
    function showNotification(message, type) {
        const alertClass = 'alert-' + (type || 'info');
        const alertHtml = '<div class="alert ' + alertClass + ' alert-dismissible fade show" role="alert">' +
            message +
            '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
            '</div>';

        // Find the tab content and prepend the alert
        const activeTab = $('button.nav-link.active').attr('data-bs-target');
        $(activeTab).prepend(alertHtml);

        // Auto-dismiss after 5 seconds
        setTimeout(function() {
            $('.alert').alert('close');
        }, 5000);
    }

    // Handle form submissions
    $('#general-settings-form').submit(function(e) {
        e.preventDefault();
        saveSettings($(this), 'general');
    });

    $('#auth-settings-form').submit(function(e) {
        e.preventDefault();
        saveSettings($(this), 'auth');
    });

    $('#api-settings-form').submit(function(e) {
        e.preventDefault();
        saveSettings($(this), 'api');
    });

    // Modified function to save settings
    function saveSettings(form, section) {
        const formData = form.serializeArray();
        const data = {};

        // Process form data into an object
        $.each(formData, function(i, field) {
            data[field.name] = field.value;
        });

        // Add checkboxes (they're not included in serializeArray if unchecked)
        form.find('input[type="checkbox"]').each(function() {
            const name = $(this).attr('name');
            data[name] = $(this).prop('checked');
        });

        // Show loading button state
        const submitBtn = form.find('button[type="submit"]');
        const originalBtnText = submitBtn.html();
        submitBtn.html('<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Saving...').prop('disabled', true);

        // Save to localStorage for Netlify deployments
        localStorage.setItem('portal_config_' + section, JSON.stringify(data));

        // Check if we're in Netlify environment
        if (config.local === false) {
            // We're in Netlify, just save to localStorage
            // Reset button
            submitBtn.html(originalBtnText).prop('disabled', false);

            // Show success toast
            showNotification('Settings saved successfully!', 'success');

            // Additional specific settings
            if (section === 'auth' && data.au10tix_token) {
                localStorage.setItem('au10tixToken', data.au10tix_token);
            }

            if (section === 'general' && data.theme) {
                localStorage.setItem('portalTheme', data.theme);
                applyThemeSettings();
            }

            return;
        }

        // Make API request to save settings
        $.ajax({
            url: '/save-config',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                section: section,
                settings: data
            }),
            success: function(response) {
                // Reset button
                submitBtn.html(originalBtnText).prop('disabled', false);

                // Show success toast
                const toast = new bootstrap.Toast(document.getElementById('settings-saved-toast'));
                toast.show();

                // If saving auth settings, store the Au10tix token in localStorage
                if (section === 'auth' && data.au10tix_token) {
                    localStorage.setItem('au10tixToken', data.au10tix_token);
                }

                // For general settings, save theme to localStorage and apply it
                if (section === 'general' && data.theme) {
                    localStorage.setItem('portalTheme', data.theme);
                    applyThemeSettings();
                }
            },
            error: function(xhr) {
                // Reset button
                submitBtn.html(originalBtnText).prop('disabled', false);

                let errorMsg = 'Failed to save settings';
                try {
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.error) errorMsg = resp.error;
                } catch (e) {}

                // Create and show error alert
                const errorAlert = $('<div class="alert alert-danger alert-dismissible fade show" role="alert">' +
                    '<i class="bi bi-exclamation-triangle-fill me-2"></i> ' + errorMsg +
                    '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
                    '</div>');

                form.prepend(errorAlert);

                // Auto-dismiss after 5 seconds
                setTimeout(function() {
                    errorAlert.alert('close');
                }, 5000);
            }
        });
    }

    // Theme toggle functionality
    function initThemeToggle() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('portalTheme');

        if (savedTheme) {
            // Apply saved theme
            if (savedTheme === 'dark') {
                $('body').addClass('dark-mode');
                $('#theme-select').val('dark');
            } else if (savedTheme === 'light') {
                $('body').removeClass('dark-mode');
                $('#theme-select').val('light');
            } else if (savedTheme === 'auto') {
                $('#theme-select').val('auto');
                // Apply based on system preference
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    $('body').addClass('dark-mode');
                } else {
                    $('body').removeClass('dark-mode');
                }
            }
        }

        // Toggle theme when button is clicked
        $('#theme-toggle').click(function() {
            toggleTheme();
        });
    }

    // Function to toggle between light and dark themes
    function toggleTheme() {
        // Create flash effect
        const flash = $('<div class="theme-change-flash"></div>');
        $('body').append(flash);

        // Toggle dark mode class
        if ($('body').hasClass('dark-mode')) {
            $('body').removeClass('dark-mode');
            localStorage.setItem('portalTheme', 'light');
            $('#theme-select').val('light');
        } else {
            $('body').addClass('dark-mode');
            localStorage.setItem('portalTheme', 'dark');
            $('#theme-select').val('dark');
        }

        // Remove flash after animation
        setTimeout(function() {
            flash.remove();
        }, 300);
    }

    // Apply theme settings immediately when changed in dropdown
    function applyThemeSettings() {
        const theme = $('#theme-select').val();
        localStorage.setItem('portalTheme', theme);

        if (theme === 'dark') {
            $('body').addClass('dark-mode');
        } else if (theme === 'light') {
            $('body').removeClass('dark-mode');
        } else if (theme === 'auto') {
            // Check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                $('body').addClass('dark-mode');
            } else {
                $('body').removeClass('dark-mode');
            }

            // Listen for system preference changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
                if (localStorage.getItem('portalTheme') === 'auto') {
                    if (event.matches) {
                        $('body').addClass('dark-mode');
                    } else {
                        $('body').removeClass('dark-mode');
                    }
                }
            });
        }
    }

    // Load configuration on page load
    loadConfigValues();

    // Load configuration when switching tabs
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
        loadConfigValues();
    });

    // Handle the URL hash to select the proper tab on page load
    if (location.hash) {
        const tabId = location.hash.substring(1); // Remove the '#' character
        const tabButton = $('button[data-bs-target="#' + tabId + '"]');
        if (tabButton.length) {
            tabButton.tab('show');
        }
    }

    // Apply theme immediately when changed
    $('#theme-select').change(function() {
        applyThemeSettings();
    });

    // Initialize theme on page load
    initThemeToggle();
    applyThemeSettings();

    // Handle config export/import
    $('#export-config').click(function() {
        // Modified export for Netlify deployment
        if (config.local === false) {
            // Export from localStorage
            const exportData = {
                general: JSON.parse(localStorage.getItem('portal_config_general') || '{}'),
                auth: JSON.parse(localStorage.getItem('portal_config_auth') || '{}'),
                api: JSON.parse(localStorage.getItem('portal_config_api') || '{}'),
                metadata: {
                    exported_at: new Date().toISOString(),
                    exported_by: 'User',
                    environment: 'Netlify'
                }
            };

            // Create a downloadable JSON file
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "portal-config.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            return;
        }

        // Original export functionality for backend API
        $.ajax({
            url: '/export-config',
            method: 'GET',
            success: function(response) {
                // Create a downloadable JSON file
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "portal-config.json");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            },
            error: function() {
                alert('Failed to export configuration');
            }
        });
    });

    // Import config functionality - new code for Netlify
    $('#import-config-btn').click(function() {
        $('#import-config-file').click();
    });

    $('#import-config-file').change(function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const configData = JSON.parse(event.target.result);

                // Store in localStorage
                if (configData.general) {
                    localStorage.setItem('portal_config_general', JSON.stringify(configData.general));
                }
                if (configData.auth) {
                    localStorage.setItem('portal_config_auth', JSON.stringify(configData.auth));
                }
                if (configData.api) {
                    localStorage.setItem('portal_config_api', JSON.stringify(configData.api));
                }

                showNotification('Configuration imported successfully! Reloading page...', 'success');

                // Reload the page after 2 seconds to apply changes
                setTimeout(function() {
                    window.location.reload();
                }, 2000);
            } catch (error) {
                showNotification('Failed to import configuration: ' + error.message, 'danger');
            }
        };
        reader.readAsText(file);
    });
});