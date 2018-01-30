FROM ubuntu:latest

RUN useradd -ms /bin/bash frank

RUN apt-get -y update
RUN apt-get install -y python3 python3-pip

ADD bin /bin/hackos
RUN chmod -R +x /bin/hackos
RUN pip3 install tabulate pyyaml

ADD cfutils.yml /etc/hackos/cfutils.yml
RUN chmod 777 /etc/hackos -R

ENV HOME /home/frank
USER frank

WORKDIR /home/frank
ADD home /home/frank

RUN echo 'export PATH="/bin/hackos:$PATH"' >> /home/frank/.bashrc
RUN echo 'alias help=/bin/hackos/help' >> ~/.bashrc

CMD [ '/bin/bash' ]
