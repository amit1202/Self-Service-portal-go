/* shared.js - Shared functionality for all pages */

// Theme handling functions that need to be available everywhere
function initThemeToggle() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('portalTheme');
    
    if (savedTheme) {
        // Apply saved theme
        if (savedTheme === 'dark') {
            $('body').addClass('dark-mode');
        } else if (savedTheme === 'light') {
            $('body').removeClass('dark-mode');
        } else if (savedTheme === 'auto') {
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
    } else {
        $('body').addClass('dark-mode');
        localStorage.setItem('portalTheme', 'dark');
    }
    
    // Remove flash after animation
    setTimeout(function() {
        flash.remove();
    }, 300);
}

// Initialize theme on page load
$(document).ready(function() {
    initThemeToggle();
    
    // Listen for system preference changes if theme is set to auto
    if (localStorage.getItem('portalTheme') === 'auto') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (event.matches) {
                $('body').addClass('dark-mode');
            } else {
                $('body').removeClass('dark-mode');
            }
        });
    }
});
