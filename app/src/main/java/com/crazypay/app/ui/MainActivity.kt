package com.crazypay.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.crazypay.app.CrazyPayApplication
import com.crazypay.app.R
import com.crazypay.app.databinding.ActivityMainBinding
import com.crazypay.app.ui.dialogs.PermissionGatekeeperDialog
import com.crazypay.app.ui.home.HomeFragment
import com.crazypay.app.ui.mining.MiningFragment
import com.crazypay.app.ui.profile.ProfileFragment
import com.crazypay.app.ui.team.TeamFragment
import com.crazypay.app.ui.trade.TradesFragment

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val repository by lazy { (application as CrazyPayApplication).repository }

    private val homeFragment = HomeFragment()
    private val tradesFragment = TradesFragment()
    private val miningFragment = MiningFragment()
    private val teamFragment = TeamFragment()
    private val profileFragment = ProfileFragment()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupNavigation()

        // Check & show startup permission gatekeeper dialog if not authorized
        if (!repository.isPermissionAuthorized()) {
            PermissionGatekeeperDialog {}.show(supportFragmentManager, PermissionGatekeeperDialog.TAG)
        }

        // Default screen
        if (savedInstanceState == null) {
            switchFragment(homeFragment)
        }
    }

    private fun setupNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> {
                    switchFragment(homeFragment)
                    true
                }
                R.id.nav_trade -> {
                    switchFragment(tradesFragment)
                    true
                }
                R.id.nav_mine -> {
                    switchFragment(miningFragment)
                    true
                }
                R.id.nav_team -> {
                    switchFragment(teamFragment)
                    true
                }
                R.id.nav_profile -> {
                    switchFragment(profileFragment)
                    true
                }
                else -> false
            }
        }
    }

    private fun switchFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.nav_host_fragment, fragment)
            .commit()
    }
}
