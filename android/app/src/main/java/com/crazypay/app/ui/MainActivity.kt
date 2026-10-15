package com.crazypay.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.crazypay.app.R
import com.crazypay.app.ui.home.HomeFragment
import com.crazypay.app.ui.mine.MineFragment
import com.crazypay.app.ui.team.TeamFragment
import com.crazypay.app.ui.trade.TradeFragment
import com.crazypay.app.ui.upi.UpiFragment
import com.google.android.material.bottomnavigation.BottomNavigationView

class MainActivity : AppCompatActivity() {

    private lateinit var bottomNav: BottomNavigationView

    private val homeFragment = HomeFragment()
    private val tradeFragment = TradeFragment()
    private val upiFragment = UpiFragment()
    private val teamFragment = TeamFragment()
    private val mineFragment = MineFragment()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        bottomNav = findViewById(R.id.bottomNavigationView)

        if (savedInstanceState == null) {
            loadFragment(homeFragment)
        }

        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.navigation_home -> {
                    loadFragment(homeFragment)
                    true
                }
                R.id.navigation_trade -> {
                    loadFragment(tradeFragment)
                    true
                }
                R.id.navigation_upi -> {
                    loadFragment(upiFragment)
                    true
                }
                R.id.navigation_team -> {
                    loadFragment(teamFragment)
                    true
                }
                R.id.navigation_mine -> {
                    loadFragment(mineFragment)
                    true
                }
                else -> false
            }
        }
    }

    private fun loadFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.nav_host_container, fragment)
            .commit()
    }

    fun switchTab(menuItemId: Int) {
        bottomNav.selectedItemId = menuItemId
    }
}
