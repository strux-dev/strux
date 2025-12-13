/**
 *
 *
 *  Network Service File for Systemd
 *
 */

export const NETWORK_SERVICE = `
[Match]
Name=eth* enp* ens* eno*

[Network]
DHCP=yes
IPv6AcceptRA=yes

[DHCPv4]
UseDomains=yes
`